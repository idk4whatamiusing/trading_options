"use client";

import { useState } from "react";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="flex w-12 flex-col items-center gap-3 border-r border-zinc-800 bg-zinc-950 p-2">
        <button onClick={() => setCollapsed(false)} aria-label="expand" className="text-zinc-400 hover:text-zinc-100">»</button>
      </div>
    );
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between p-3">
        <span className="text-sm font-semibold text-zinc-200">Alpaca Agent</span>
        <button onClick={() => setCollapsed(true)} aria-label="collapse" className="text-zinc-500 hover:text-zinc-200">«</button>
      </div>
      <nav className="flex-1 px-3 py-2 text-sm text-zinc-300">
        <a href="/dashboard" className="block rounded-lg px-2 py-1.5 hover:bg-zinc-900">Dashboard</a>
        <a href="/" className="block rounded-lg px-2 py-1.5 hover:bg-zinc-900">Home</a>
      </nav>
      <div className="border-t border-zinc-800 p-3 text-xs text-zinc-500">
        TradingAgents + Alpaca MCP, options-only, paper trading.
      </div>
    </aside>
  );
}
