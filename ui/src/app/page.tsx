export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Alpaca Options Agent</h1>
      <p className="text-zinc-400">
        An autonomous options-trading agent for Alpaca paper trading: TradingAgents (multi-agent LLM
        signal generation) picks a direction, a separate LLM tool-use step structures the options
        trade against a live Alpaca chain via MCP, deterministic risk gates veto anything unsafe,
        and only then does an isolated executor place the order.
      </p>
      <ul className="grid gap-2 text-sm text-zinc-400">
        <li>
          <code className="text-emerald-400">ui</code> Next.js :3000 - this dashboard
        </li>
        <li>
          <code className="text-emerald-400">api</code> Go :8000 - GraphQL over the trading domain;{" "}
          <code>db</code> Rust tonic :8010 - Postgres gatekeeper
        </li>
        <li>
          <code className="text-emerald-400">realtime</code> Gleam :8001 - live activity feed fanout
        </li>
        <li>
          <code className="text-emerald-400">ai</code> Go :8002 + Python :8003 - the trading brain
          (TradingAgents, options structuring, risk gates, Alpaca MCP execution)
        </li>
      </ul>
      <a
        href="/dashboard"
        className="w-fit rounded-lg bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500"
      >
        Dashboard
      </a>
    </main>
  );
}
