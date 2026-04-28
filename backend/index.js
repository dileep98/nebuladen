const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const url = require("url");
const rateLimit = require("express-rate-limit");
const logger = require("./logger");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const agentRoutes = require("./routes/agent");
const { verifyToken } = require("./middleware/auth");
const { handleAgentConnection } = require("./agent");

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true });

app.use(cors({
  origin: ["http://localhost:3000", "https://nebuladen.vercel.app"],
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("http_request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      ip: req.ip,
    });
  });
  next();
});

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts, please try again later." },
});

app.use(globalLimiter);
app.use("/auth", authLimiter, authRoutes);
app.use("/agent", verifyToken, agentRoutes);

app.get("/health", (req, res) => {
  logger.info("health_check", { status: "ok" });
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/metrics", async (req, res) => {
  const { getMetrics } = require("./metrics");
  const { getSessions } = require("./agent");
  const metrics = await getMetrics(Object.keys(getSessions()).length);
  logger.info("metrics_requested", metrics);
  res.json(metrics);
});

// WebSocket upgrade
server.on("upgrade", (request, socket, head) => {
  const parsedUrl = url.parse(request.url, true);
  const token = parsedUrl.query.token;
  const pathname = parsedUrl.pathname;

  if (pathname !== "/ws") {
    socket.destroy();
    return;
  }

  if (!token) {
    logger.warn("websocket_rejected", { reason: "no_token" });
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  try {
    const user = verifyToken(token);
    logger.info("websocket_connected", { userId: user.id, name: user.name });
    request.user = user;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } catch (err) {
    logger.warn("websocket_rejected", { reason: "invalid_token", error: err.message });
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

wss.on("connection", (ws, request) => {
  handleAgentConnection(ws, request.user);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("shutdown", { reason: "SIGTERM received" });
  server.close(() => {
    logger.info("shutdown", { reason: "HTTP server closed" });
    process.exit(0);
  });
});

process.on("uncaughtException", (err) => {
  logger.error("uncaught_exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", { reason: String(reason) });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  logger.info("server_started", { port: PORT, env: process.env.NODE_ENV || "development" });
});