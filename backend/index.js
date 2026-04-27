const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const url = require("url");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const agentRoutes = require("./routes/agent");
const { verifyToken } = require("./middleware/auth");
const { handleAgentConnection } = require("./agent");

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ noServer: true });

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/agent", verifyToken, agentRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Upgrade HTTP to WebSocket
server.on("upgrade", (request, socket, head) => {
  const { query } = url.parse(request.url, true);
  const token = query.token;

  if (!token) {
    socket.destroy();
    return;
  }

  try {
    const user = verifyToken(token);
    request.user = user;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } catch {
    socket.destroy();
  }
});

wss.on("connection", (ws, request) => {
  handleAgentConnection(ws, request.user);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`NebulaDen backend running on port ${PORT}`);
});