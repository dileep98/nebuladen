const { exec } = require("child_process");
const Anthropic = require("@anthropic-ai/sdk");
const { logActivity } = require("./metrics");
const logger = require("./logger");

const sessions = {};
const messageCounts = {};
const DAILY_MESSAGE_LIMIT = 50;
const MESSAGE_COOLDOWN_MS = 3000;

function getSessions() {
  return sessions;
}

function getDayKey() {
  return new Date().toISOString().split("T")[0];
}

function checkRateLimit(userId) {
  const dayKey = getDayKey();
  if (!messageCounts[userId]) {
    messageCounts[userId] = { count: 0, day: dayKey, lastMessage: 0 };
  }
  if (messageCounts[userId].day !== dayKey) {
    messageCounts[userId] = { count: 0, day: dayKey, lastMessage: 0 };
  }
  const now = Date.now();
  const timeSinceLast = now - messageCounts[userId].lastMessage;
  if (timeSinceLast < MESSAGE_COOLDOWN_MS) {
    return { allowed: false, reason: `Please wait ${Math.ceil((MESSAGE_COOLDOWN_MS - timeSinceLast) / 1000)} seconds before sending another message.` };
  }
  if (messageCounts[userId].count >= DAILY_MESSAGE_LIMIT) {
    return { allowed: false, reason: `You've reached your daily limit of ${DAILY_MESSAGE_LIMIT} messages. Limit resets at midnight UTC.` };
  }
  messageCounts[userId].count++;
  messageCounts[userId].lastMessage = now;
  return { allowed: true };
}

async function handleAgentConnection(ws, user) {
  logger.info("agent_connected", { userId: user.id, name: user.name });
  sessions[user.id] = { ws, user, history: [] };

  logActivity(user.id, "connect", "Agent session started");

  ws.on("message", async (data) => {
    try {
      const { command, mode } = JSON.parse(data);
      const session = sessions[user.id];

      const rateCheck = checkRateLimit(user.id);
      if (!rateCheck.allowed) {
        ws.send(JSON.stringify({ output: `⚠️ ${rateCheck.reason}`, type: "error" }));
        return;
      }

      session.history.push({ role: "user", content: command });

      // Log the activity
      if (command.startsWith("$ ") || command.toLowerCase().startsWith("run:")) {
        const cmd = command.replace(/^\$\s*/, "").replace(/^run:\s*/i, "");
        logActivity(user.id, "shell", `Ran: ${cmd}`);
      } else {
        logActivity(user.id, "chat", command.slice(0, 60) + (command.length > 60 ? "..." : ""));
      }

      const output = await runAgent(command, session.history, mode);
      session.history.push({ role: "assistant", content: output });

      if (session.history.length > 20) {
        session.history = session.history.slice(-20);
      }

      ws.send(JSON.stringify({ output, type: "response" }));
    } catch (err) {
      ws.send(JSON.stringify({ output: `Error: ${err.message}`, type: "error" }));
    }
  });

  ws.on("close", () => {
    logger.info("agent_disconnected", { userId: user.id, name: user.name });
    logActivity(user.id, "disconnect", "Agent session ended");
    delete sessions[user.id];
  });

  ws.send(JSON.stringify({
    output: `Good ${getTimeOfDay()}, ${user.name}! I'm your Nebula agent running on a cloud machine. What shall we build today?\n\n_Daily limit: ${DAILY_MESSAGE_LIMIT} messages_`,
    type: "welcome",
  }));
}

async function runAgent(command, history, mode) {
  const trimmed = command.trim();
  
  // Split by newlines and check if multiple shell commands
  const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
  const allShell = lines.every(l => l.startsWith("$") || l.toLowerCase().startsWith("run:"));

  if (lines.length > 1 && allShell) {
    // Multiple shell commands — run each and combine output
    const outputs = [];
    for (const line of lines) {
      const cmd = line.replace(/^\$\s*/, "").replace(/^run:\s*/i, "");
      const result = await executeShell(cmd);
      outputs.push(`$ ${cmd}\n${result}`);
    }
    return outputs.join("\n\n");
  }

  // Single shell command
  if (trimmed.startsWith("$ ") || trimmed.toLowerCase().startsWith("run:")) {
    const cmd = trimmed.replace(/^\$\s*/, "").replace(/^run:\s*/i, "");
    return await executeShell(cmd);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: mode === "fast" ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are Nebula, an AI agent running on a dedicated cloud machine (AWS EC2 t3.micro, Ubuntu). 
You help users by executing tasks, writing code, managing files, and answering questions.
When a user asks you to run something, prefix the command with $ and explain what it does.
Be concise, practical, and technical. You have access to a real Linux terminal.`,
      messages: history,
    });
    return response.content[0].text;
  } catch (err) {
    return `I'm having trouble connecting to my brain right now. Error: ${err.message}`;
  }
}

const BLOCKED_COMMANDS = [
  // Destructive
  "rm -rf /", "rm -rf ~", "mkfs", "dd if=", ":(){:|:&};:",
  "chmod -R 777 /", "chown -R",
  // Network abuse
  "curl http://malicious", "wget http://",
  // Privilege escalation
  "sudo su", "sudo -i", "su root",
  // Sensitive files
  "cat /etc/shadow", "cat /etc/passwd",
  "/proc/", "/sys/",
  // Fork bombs and infinite loops
  "while true", "for(;;)",
];

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+[\/~]/, // rm -rf / or rm -rf ~
  />\s*\/dev\/sd/, // writing to disk devices
  /chmod\s+[0-7]*7[0-7]*\s+\//, // chmod 777 /
  /curl.*\|\s*bash/, // curl | bash (remote code execution)
  /wget.*\|\s*bash/, // wget | bash
  /nc\s+-l/, // netcat listener
  /python.*-c.*import\s+os.*system/, // python os.system
];

function executeShell(command) {
  return new Promise((resolve) => {
    // Check blocklist
    const isBlocked = BLOCKED_COMMANDS.some((b) =>
      command.toLowerCase().includes(b.toLowerCase())
    );
    if (isBlocked) {
      logger.warn("shell_blocked", { command });
      resolve("⚠️ That command is blocked for safety reasons.");
      return;
    }

    // Check patterns
    const matchesPattern = BLOCKED_PATTERNS.some((p) => p.test(command));
    if (matchesPattern) {
      logger.warn("shell_blocked_pattern", { command });
      resolve("⚠️ That command pattern is blocked for safety reasons.");
      return;
    }

    // Limit output size
    exec(
      command,
      {
        timeout: 10000,
        maxBuffer: 1024 * 512, // 512KB max output
        env: {
          ...process.env,
          PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          logger.warn("shell_error", { command, error: error.message });
          resolve(`Error:\n${stderr || error.message}`);
        } else {
          const output = stdout || "Command executed successfully (no output)";
          // Truncate if too long
          if (output.length > 3000) {
            resolve(output.slice(0, 3000) + "\n... (output truncated)");
          } else {
            resolve(output);
          }
        }
      }
    );
  });
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

module.exports = { handleAgentConnection, getSessions };