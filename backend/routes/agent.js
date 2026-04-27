const express = require("express");
const router = express.Router();

// Store agent status per user (in memory for now)
const agentStatus = {};

router.get("/status", (req, res) => {
  const userId = req.user.id;
  const status = agentStatus[userId] || {
    status: "online",
    tasksRun: 0,
    uptime: "100%",
    region: "us-east-1",
    instance: "t2.micro",
  };
  res.json(status);
});

router.post("/status", (req, res) => {
  const userId = req.user.id;
  agentStatus[userId] = { ...agentStatus[userId], ...req.body };
  res.json({ ok: true });
});

module.exports = router;