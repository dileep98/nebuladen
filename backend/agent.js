const { exec } = require("child_process");
const Anthropic = require("@anthropic-ai/sdk");

// Track sessions per user
const sessions = {};

async function handleAgentConnection(ws, user) {
  console.log(`Agent connected for user: ${user.name}`);

  sessions[user.id] = { ws, user, history: [] };

  ws.on("message", async (data) => {
    try {
      const { command, mode } = JSON.parse(data);
      const session = sessions[user.id];

      session.history.push({ role: "user", content: command });

      const output = await runAgent(command, session.history, mode);

      session.history.push({ role: "assistant", content: output });

      ws.send(JSON.stringify({ output, type: "response" }));
    } catch (err) {
      ws.send(JSON.stringify({ output: `Error: ${err.message}`, type: "error" }));
    }
  });

  ws.on("close", () => {
    console.log(`Agent disconnected for user: ${user.name}`);
    delete sessions[user.id];
  });

  // Send welcome message
  ws.send(JSON.stringify({
    output: `Good ${getTimeOfDay()}, ${user.name}! I'm your Nebula agent running on a cloud machine. What shall we build today?`,
    type: "welcome",
  }));
}

async function runAgent(command, history, mode) {
  // Check if it's a shell command (starts with $ or "run:")
  if (command.startsWith("$ ") || command.toLowerCase().startsWith("run:")) {
    const cmd = command.replace(/^\$\s*/, "").replace(/^run:\s*/i, "");
    return await executeShell(cmd);
  }

  // Otherwise use Claude as the brain
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: mode === "fast" ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are Nebula, an AI agent running on a dedicated cloud machine (AWS EC2 t2.micro, Ubuntu). 
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

function executeShell(command) {
  return new Promise((resolve) => {
    // Safety: block dangerous commands
    const blocked = ["rm -rf /", "mkfs", "dd if=", ":(){:|:&};:"];
    if (blocked.some((b) => command.includes(b))) {
      resolve("⚠️ That command is blocked for safety reasons.");
      return;
    }

    exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        resolve(`Error:\n${stderr || error.message}`);
      } else {
        resolve(stdout || "Command executed successfully (no output)");
      }
    });
  });
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

module.exports = { handleAgentConnection };