const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const url = require("url");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const agentRoutes = require("./routes/agent");
const { verifyToken } = require("./middleware/auth");
const { handleAgentConnection } = require("./agent");

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ noServer: true });

app.use(cors({ 
  origin: ["http://localhost:3000", "https://nebuladen.vercel.app"],
  credentials: true 
}));
app.use(express.json());

// Global rate limit — 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later." },
});

// Auth rate limit — 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts, please try again later." },
});

app.use(globalLimiter);
app.use("/auth", authLimiter, authRoutes);
app.use("/agent", verifyToken, agentRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

server.on("upgrade", (request, socket, head) => {
  const parsedUrl = url.parse(request.url, true);
  const token = parsedUrl.query.token;
  const pathname = parsedUrl.pathname;

  if (pathname !== "/ws") {
    socket.destroy();
    return;
  }

  if (!token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
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
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
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