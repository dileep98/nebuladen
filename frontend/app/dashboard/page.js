"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [agentStats, setAgentStats] = useState({
    tasksRun: 0,
    uptime: "100%",
    region: "us-east-1",
    cpu: 0,
    memory: { percent: 0, used: 0, total: 0 },
    disk: { percent: 0 },
    activity: [],
  });

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) { router.push("/login"); return; }
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser(payload);
        const stats = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agent/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const statsData = await stats.json();
        setAgentStats(statsData);
      } catch {
        router.push("/login");
      }
    })();
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("token");
    router.push("/");
  }

  function timeAgo(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  function activityIcon(type) {
    if (type === "shell") return "⌨️";
    if (type === "connect") return "🔌";
    if (type === "disconnect") return "💤";
    return "💬";
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-sm font-bold">N</div>
          <span className="text-lg font-semibold tracking-tight">NebulaDen</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/40">Hey, {user.name} 👋</span>
          <button onClick={handleLogout} className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">Your Agent</h1>
        <p className="text-white/50 mb-10">Your personal Nebula is ready and waiting for instructions.</p>

        {/* Agent Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-3xl">🌌</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold">Nebula-{user.id?.slice(0, 6) || "001"}</h2>
                <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-full">Online</span>
              </div>
              <p className="text-white/40 text-sm">Personal agent · {agentStats.instance || "t3.micro"} · {agentStats.region || "us-east-1"}</p>
            </div>
          </div>
          <button onClick={() => router.push("/chat")} className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-medium transition text-sm">
            Open Chat →
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { label: "Tasks run", value: agentStats.tasksRun ?? "0" },
            { label: "Uptime", value: agentStats.uptime ?? "100%" },
            { label: "CPU", value: `${agentStats.cpu ?? 0}%` },
            { label: "Memory", value: `${agentStats.memory?.percent ?? 0}%` },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-white/40 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Resource bars */}
        <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold mb-2">System Resources</h3>
          {[
            { label: "CPU", percent: agentStats.cpu ?? 0 },
            { label: "RAM", percent: agentStats.memory?.percent ?? 0 },
            { label: "Disk", percent: agentStats.disk?.percent ?? 0 },
          ].map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/60">{r.label}</span>
                <span className="text-white/40">{r.percent}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${r.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Recent Activity</h3>
          {agentStats.activity?.length > 0 ? (
            <div className="space-y-3">
              {agentStats.activity.slice(0, 8).map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-lg shrink-0">{activityIcon(item.type)}</span>
                  <div className="flex-1">
                    <p className="text-white/70">{item.description}</p>
                    <p className="text-white/30 text-xs mt-0.5">{timeAgo(item.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/30 text-sm text-center py-8">
              No activity yet — open chat and give your agent its first task!
            </div>
          )}
        </div>
      </div>
    </main>
  );
}