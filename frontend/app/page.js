export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-sm font-bold">N</div>
          <span className="text-lg font-semibold tracking-tight">NebulaDen</span>
        </div>
        <div className="flex gap-3">
          <a href="/login" className="px-4 py-2 text-sm text-white/70 hover:text-white transition">Login</a>
          <a href="/signup" className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg transition">Get Started</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 text-center px-4 py-24">
        <div className="inline-block px-3 py-1 mb-6 text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full">
          Now in Early Access
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
          Your agent.<br />Its own computer.
        </h1>
        <p className="text-lg text-white/50 max-w-xl mb-10">
          NebulaDen gives you a personal AI agent backed by a real cloud machine. 
          Chat with it, give it tasks, watch it execute — all in real time.
        </p>
        <div className="flex gap-4">
          <a href="/signup" className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-medium transition">
            Launch your agent →
          </a>
          <a href="#how" className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition">
            How it works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-8 py-20 border-t border-white/10">
        <h2 className="text-center text-3xl font-bold mb-14">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            { step: "01", title: "Create your account", desc: "Sign up and get instant access to your personal agent dashboard." },
            { step: "02", title: "Meet your Nebula", desc: "Your agent spins up on a real cloud machine, ready to take on tasks." },
            { step: "03", title: "Chat & execute", desc: "Give it instructions in plain English. It runs code, manages files, and reports back." },
          ].map((item) => (
            <div key={item.step} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="text-violet-400 text-sm font-mono mb-3">{item.step}</div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-white/50 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-6 border-t border-white/10 text-center text-white/30 text-sm">
        © 2026 NebulaDen. All rights reserved.
      </footer>
    </main>
  );
}