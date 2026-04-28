"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Chat() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "agent",
      text: "Hey! I'm your Nebula agent. I'm running on a cloud machine and ready to execute tasks. What would you like me to do?",
    },
  ]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUser(payload);
    } catch {
      router.push("/login");
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://nebuladen.duckdns.org";
    const ws = new WebSocket(`${wsUrl}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, { role: "agent", text: data.output }]);
      setLoading(false);
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    if (!input.trim() || !connected || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    wsRef.current.send(JSON.stringify({ command: text }));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-white/40 hover:text-white transition text-sm"
          >
            ← Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="text-xl">🌌</div>
            <span className="font-medium">Nebula-{user.id?.slice(0, 6) || "001"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-sm text-white/40">{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </nav>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "agent" && (
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm mr-3 shrink-0 mt-1">
                🌌
              </div>
            )}
            <div
              className={`max-w-xl px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-600 text-white rounded-tr-sm whitespace-pre-wrap"
                  : "bg-white/5 border border-white/10 text-white/80 rounded-tl-sm"
              }`}
            >
              {msg.role === "agent" ? (
                <div style={{
                  lineHeight: "1.6",
                  fontSize: "13px",
                }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({children}) => <h1 style={{fontSize:"16px", fontWeight:"600", marginBottom:"8px", color:"rgba(255,255,255,0.9)"}}>{children}</h1>,
                      h2: ({children}) => <h2 style={{fontSize:"14px", fontWeight:"600", marginBottom:"6px", marginTop:"12px", color:"rgba(255,255,255,0.9)"}}>{children}</h2>,
                      h3: ({children}) => <h3 style={{fontSize:"13px", fontWeight:"600", marginBottom:"4px", marginTop:"10px", color:"rgba(255,255,255,0.85)"}}>{children}</h3>,
                      p: ({children}) => <p style={{marginBottom:"8px", color:"rgba(255,255,255,0.8)"}}>{children}</p>,
                      ul: ({children}) => <ul style={{paddingLeft:"16px", marginBottom:"8px", listStyleType:"disc"}}>{children}</ul>,
                      ol: ({children}) => <ol style={{paddingLeft:"16px", marginBottom:"8px", listStyleType:"decimal"}}>{children}</ol>,
                      li: ({children}) => <li style={{marginBottom:"2px", color:"rgba(255,255,255,0.8)"}}>{children}</li>,
                      code: ({inline, children}) => inline 
                        ? <code style={{background:"rgba(255,255,255,0.1)", color:"#c4b5fd", padding:"1px 5px", borderRadius:"4px", fontSize:"12px", fontFamily:"monospace"}}>{children}</code>
                        : <code>{children}</code>,
                      pre: ({children}) => <pre style={{background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", padding:"12px", overflowX:"auto", marginBottom:"8px", fontSize:"12px", fontFamily:"monospace"}}>{children}</pre>,
                      strong: ({children}) => <strong style={{fontWeight:"600", color:"rgba(255,255,255,0.95)"}}>{children}</strong>,
                      hr: () => <hr style={{borderColor:"rgba(255,255,255,0.1)", margin:"12px 0"}}/>,
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm mr-3 shrink-0">
              🌌
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Give your agent a task... (Enter to send)"
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500 transition placeholder:text-white/20 resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={!connected || loading || !input.trim()}
            className="px-5 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 rounded-xl font-medium transition text-sm shrink-0"
          >
            Send
          </button>
        </div>
        <p className="text-center text-white/20 text-xs mt-2">
          Your agent is running on a real cloud machine
        </p>
      </div>
    </main>
  );
}