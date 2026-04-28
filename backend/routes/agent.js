const express = require("express");
const { getMetrics, getActivity } = require("../metrics");
const { getSessions } = require("../agent");

const router = express.Router();

router.get("/status", async (req, res) => {
  const userId = req.user.id;
  const sessions = getSessions();
  const metrics = await getMetrics(Object.keys(sessions).length);
  const activity = getActivity(userId);

  res.json({
    tasksRun: activity.length,
    uptime: metrics.uptime,
    region: metrics.region,
    instance: metrics.instance,
    cpu: metrics.cpu,
    memory: metrics.memory,
    disk: metrics.disk,
    activeSessions: metrics.activeSessions,
    activity,
  });
});

module.exports = router;