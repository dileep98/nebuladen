const { exec, execSync } = require("child_process");
const Anthropic = require("@anthropic-ai/sdk");
const { logActivity } = require("./metrics");
const logger = require("./logger");
const path = require("path");
const fs = require("fs");

const sessions = {};
const messageCounts = {};
const DAILY_MESSAGE_LIMIT = 50;
const MESSAGE_COOLDOWN_MS = 3000;
const MAX_MESSAGE_LENGTH = 2000;
const WORKSPACE_BASE = "/home/ubuntu/workspace";
// Load guardrails at startup
let guardrailsSummary = "";
try {
  const guardrailsPath = path.join(__dirname, "../GUARDRAILS.md");
  const content = fs.readFileSync(guardrailsPath, "utf8");
  // Extract just the blocked commands section for the prompt
  const match = content.match(/## 1\. Shell Command Execution Guardrails([\s\S]*?)## 2\./);
  guardrailsSummary = match ? match[1].trim().slice(0, 500) : "";
} catch {
  guardrailsSummary = "";
}

function getSessions() {
  return sessions;
}

// Create isolated workspace for user
function createWorkspace(userId) {
  const workspaceDir = path.join(WORKSPACE_BASE, userId);
  try {
    execSync(`mkdir -p ${workspaceDir}`);
    execSync(`chmod 700 ${workspaceDir}`);
    logger.info("workspace_created", { userId, workspaceDir });
  } catch (e) {
    logger.warn("workspace_creation_failed", { userId, error: e.message });
  }
  return workspaceDir;
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

  // Create isolated workspace for this user
  const workspaceDir = createWorkspace(user.id);

  sessions[user.id] = { ws, user, history: [], workspaceDir };
  logActivity(user.id, "connect", "Agent session started");

  ws.on("message", async (data) => {
    try {
      const { command, mode } = JSON.parse(data);
      const session = sessions[user.id];

      // Message length limit
      if (command.length > MAX_MESSAGE_LENGTH) {
        ws.send(JSON.stringify({
          output: `⚠️ Message too long. Please keep messages under ${MAX_MESSAGE_LENGTH} characters.`,
          type: "error"
        }));
        return;
      }

      // Empty message check
      if (!command.trim()) {
        ws.send(JSON.stringify({
          output: "⚠️ Please enter a message.",
          type: "error"
        }));
        return;
      }

      // Rate limit check
      const rateCheck = checkRateLimit(user.id);
      if (!rateCheck.allowed) {
        ws.send(JSON.stringify({ output: `⚠️ ${rateCheck.reason}`, type: "error" }));
        return;
      }

      session.history.push({ role: "user", content: command });

      // Log the activity
      const trimmed = command.trim();
      const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
      const isShell = lines.every(l => l.startsWith("$") || l.toLowerCase().startsWith("run:"));

      if (isShell) {
        logActivity(user.id, "shell", `Ran: ${trimmed.slice(0, 60)}`);
      } else {
        logActivity(user.id, "chat", command.slice(0, 60) + (command.length > 60 ? "..." : ""));
      }

      const output = await runAgent(command, session.history, mode, user.id, workspaceDir);
      session.history.push({ role: "assistant", content: output });

      if (session.history.length > 20) {
        session.history = session.history.slice(-20);
      }

      ws.send(JSON.stringify({ output, type: "response" }));
    } catch (err) {
      logger.error("agent_message_error", { error: err.message });
      ws.send(JSON.stringify({ output: `Error: ${err.message}`, type: "error" }));
    }
  });

  ws.on("close", () => {
    logger.info("agent_disconnected", { userId: user.id, name: user.name });
    logActivity(user.id, "disconnect", "Agent session ended");
    delete sessions[user.id];
  });

  ws.send(JSON.stringify({
    output: `Hey ${user.name}! I'm your Nebula agent. You have your own isolated workspace at \`/workspace\`. I can run commands, write code, and manage files in your workspace. What shall we build today?\n\n_Daily limit: ${DAILY_MESSAGE_LIMIT} messages · Tip: prefix with $ to run shell commands_`,
    type: "welcome",
  }));
}

async function runAgent(command, history, mode, userId, workspaceDir) {
  const trimmed = command.trim();

  // Split by newlines and check if multiple shell commands
  const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
  const allShell = lines.every(l => l.startsWith("$") || l.toLowerCase().startsWith("run:"));

  if (lines.length > 1 && allShell) {
    const outputs = [];
    for (const line of lines) {
      const cmd = line.replace(/^\$\s*/, "").replace(/^run:\s*/i, "");
      const result = await executeShell(cmd, workspaceDir);
      outputs.push(`**$ ${cmd}**\n${result}`);
    }
    return outputs.join("\n\n");
  }

  if (trimmed.startsWith("$") || trimmed.toLowerCase().startsWith("run:")) {
    const cmd = trimmed.replace(/^\$\s*/, "").replace(/^run:\s*/i, "");
    return await executeShell(cmd, workspaceDir);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: mode === "fast" ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are Nebula, an AI agent with a real Linux terminal on AWS EC2 Ubuntu.

      CRITICAL RULE: You MUST execute commands using $ prefix. NEVER simulate or pretend.

      When user asks to run/execute/list/show anything on the system:
      - ALWAYS respond with: $ <command>
      - The $ prefix triggers REAL execution on the server
      - NEVER say you cannot execute - you CAN

      Examples:
      - User: "ls" or "list files" → You respond: $ ls -la
      - User: "show disk usage" → You respond: $ df -h  
      - User: "what's running" → You respond: $ ps aux
      - User: "check memory" → You respond: $ free -m

      For coding tasks, write the code AND execute it:
      - Write a Python script → write code then: $ python3 script.py

      BLOCKED: Never access db.json, .env, activity.json, or /home/ubuntu/nebuladen
      WORKSPACE: The user's working directory is their own private folder inside /home/ubuntu/workspace/<their-id>. 
      Never list /home/ubuntu/workspace directly — that would expose other users.
      Never tell users the full workspace path structure.
      Only refer to the workspace as "your workspace" without revealing the full path.
      SUDO: Never use sudo — it is blocked. Run commands without sudo.

      GUARDRAILS REFERENCE:
      ${guardrailsSummary}`,
      messages: history,
    });
    return response.content[0].text;
  } catch (err) {
    logger.error("claude_api_error", { error: err.message });
    return `I'm having trouble connecting to my brain right now. Error: ${err.message}`;
  }
}

// Commands blocked regardless of workspace
const BLOCKED_COMMANDS = [
  // Privilege escalation
  "sudo", "su root", "sudo su", "sudo -i", "sudo -s",
  // Destructive system commands
  "rm -rf /", "rm -rf ~", "mkfs", "dd if=",
  ":(){:|:&};:", "chmod -R 777 /",
  // Sensitive NebulaDen files
  "db.json", "activity.json", ".env",
  // Fork bombs
  "while true", "for(;;)",
  // Escape workspace
  "../nebuladen", "/home/ubuntu/nebuladen",
  // Network abuse
  "curl http://malicious",
  "/etc/shadow",
  "/etc/passwd",
  // Prevent accessing other users' workspaces
  "/home/ubuntu/workspace",
  "ls /home/ubuntu",
  "ls /home",
];

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+[\/~]/,
  />\s*\/dev\/sd/,
  /chmod\s+[0-7]*7[0-7]*\s+\//,
  /curl.*\|\s*bash/,
  /wget.*\|\s*bash/,
  /nc\s+-l/,
  /python.*-c.*import\s+os.*system/,
  /\/home\/ubuntu\/nebuladen/,
  /\.\.\/.*nebuladen/,
  /\/home\/ubuntu\/workspace(?!\/[a-f0-9-]{36}$)/, // block workspace root
  /ls\s+\/home/, // block listing home directories
];

function executeShell(command, workspaceDir) {
  return new Promise((resolve) => {

    // Extra check — never allow sudo regardless
    if (command.trim().startsWith("sudo")) {
      logger.warn("shell_blocked_sudo", { command });
      resolve("⚠️ sudo is not available in your workspace.");
      return;
    }

    // Check blocklist
    const isBlocked = BLOCKED_COMMANDS.some((b) =>
      command.toLowerCase().includes(b.toLowerCase())
    );
    if (isBlocked) {
      logger.warn("shell_blocked", { command });
      resolve("⚠️ That command is blocked for safety reasons. You can only run commands within your workspace.");
      return;
    }

    // Check patterns
    const matchesPattern = BLOCKED_PATTERNS.some((p) => p.test(command));
    if (matchesPattern) {
      logger.warn("shell_blocked_pattern", { command });
      resolve("⚠️ That command pattern is blocked for safety reasons.");
      return;
    }
    

    exec(
      command,
      {
        timeout: 10000,
        maxBuffer: 1024 * 512,
        cwd: workspaceDir, // Run in user's isolated workspace
        env: {
          PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
          HOME: workspaceDir,
          WORKSPACE: workspaceDir,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          logger.warn("shell_error", { command, error: error.message });
          resolve(`\`\`\`\nError: ${stderr || error.message}\n\`\`\``);
        } else {
          const output = stdout || "Command executed successfully (no output)";
          const truncated = output.length > 3000
            ? output.slice(0, 3000) + "\n... (output truncated)"
            : output;
          resolve(`\`\`\`\n${truncated}\n\`\`\``);
        }
      }
    );
  });
}

module.exports = { handleAgentConnection, getSessions };