const si = require("systeminformation");

const startTime = Date.now();

// Activity log per user
const activityLog = {};

function logActivity(userId, type, description) {
  if (!activityLog[userId]) activityLog[userId] = [];
  activityLog[userId].unshift({
    type,
    description,
    timestamp: new Date().toISOString(),
  });
  // Keep only last 20 activities
  if (activityLog[userId].length > 20) {
    activityLog[userId] = activityLog[userId].slice(0, 20);
  }
}

function getActivity(userId) {
  return activityLog[userId] || [];
}

async function getMetrics(activeSessions) {
  const [cpu, mem, disk, net] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
  ]);

  const uptimeMs = Date.now() - startTime;
  const uptimeHours = Math.floor(uptimeMs / 3600000);
  const uptimeMins = Math.floor((uptimeMs % 3600000) / 60000);

  return {
    cpu: Math.round(cpu.currentLoad),
    memory: {
      used: Math.round(mem.used / 1024 / 1024),
      total: Math.round(mem.total / 1024 / 1024),
      percent: Math.round((mem.used / mem.total) * 100),
    },
    disk: {
      used: Math.round(disk[0]?.used / 1024 / 1024 / 1024),
      total: Math.round(disk[0]?.size / 1024 / 1024 / 1024),
      percent: Math.round(disk[0]?.use),
    },
    network: {
      rx: Math.round((net[0]?.rx_bytes || 0) / 1024),
      tx: Math.round((net[0]?.tx_bytes || 0) / 1024),
    },
    uptime: `${uptimeHours}h ${uptimeMins}m`,
    activeSessions,
    region: "us-east-1",
    instance: "t3.micro",
  };
}

module.exports = { getMetrics, logActivity, getActivity };