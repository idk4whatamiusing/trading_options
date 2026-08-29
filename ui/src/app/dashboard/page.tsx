"use client";

import { useEffect, useState } from "react";
import {
  createClient,
  DECISIONS,
  LATEST_SNAPSHOT,
  RISK_GATE_EVENTS,
  TRADES,
  type AccountSnapshot,
  type Decision,
  type RiskGateEvent,
  type Trade,
} from "../../../lib/gqlClient";

const api = createClient(process.env.NEXT_PUBLIC_API_URL ?? "");

function parseEvent(raw: string): string {
  // Go's hub prepends "api: " and Gleam's realtime prepends "realtime: " -
  // both wrap the same underlying JSON payload our mutations broadcast.
  const stripped = raw.replace(/^(api: |realtime: )/, "");
  try {
    const parsed = JSON.parse(stripped);
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
  } catch {
    return stripped;
  }
}

function money(n?: number | null): string {
  if (n === undefined || n === null) return "-";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "open" ? "bg-emerald-900 text-emerald-300"
    : status === "closed" ? "bg-zinc-800 text-zinc-300"
    : status === "rejected" ? "bg-red-950 text-red-300"
    : status === "failed" ? "bg-red-950 text-red-300"
    : "bg-yellow-950 text-yellow-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${color}`}>{status}</span>;
}

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskGateEvent[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const refresh = () => {
    api.graphql<{ latestSnapshot: AccountSnapshot | null }>(LATEST_SNAPSHOT)
      .then((d) => setSnapshot(d.latestSnapshot))
      .catch(() => setSnapshot(null));
    api.graphql<{ trades: Trade[] }>(TRADES, { status: null })
      .then((d) => setTrades(d.trades ?? []))
      .catch(() => setTrades([]));
    api.graphql<{ decisions: Decision[] }>(DECISIONS)
      .then((d) => setDecisions(d.decisions ?? []))
      .catch(() => setDecisions([]));
    api.graphql<{ riskGateEvents: RiskGateEvent[] }>(RISK_GATE_EVENTS)
      .then((d) => setRiskEvents(d.riskGateEvents ?? []))
      .catch(() => setRiskEvents([]));
  };

  useEffect(() => {
    refresh();
    return api.subscribe<{ events: string }>(
      "subscription { events }",
      undefined,
      (d) => {
        setEvents((prev) => [parseEvent(d.events), ...prev].slice(0, 50));
        refresh();
      },
    );
  }, []);

  const runCycleNow = async () => {
    setRunning(true);
    try {
      await api.graphql(`mutation { runCycle }`);
    } finally {
      setTimeout(() => setRunning(false), 3000);
    }
  };

  const openTrades = trades.filter((t) => t.status === "open");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trading Agent Dashboard</h1>
        <button
          onClick={runCycleNow}
          disabled={running}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {running ? "Running…" : "Run Cycle Now"}
        </button>
      </div>

      <section className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-800 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500">Equity</p>
          <p className="text-lg font-semibold">{snapshot ? money(snapshot.equity) : "-"}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Day P&L</p>
          <p className={`text-lg font-semibold ${(snapshot?.dayPnl ?? 0) < 0 ? "text-red-400" : "text-emerald-400"}`}>
            {snapshot ? money(snapshot.dayPnl) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Buying Power</p>
          <p className="text-lg font-semibold">{snapshot ? money(snapshot.buyingPower) : "-"}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Open Positions</p>
          <p className="text-lg font-semibold">{snapshot ? snapshot.openPositionsCount : "-"}</p>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Trades ({openTrades.length} open / {trades.length} total)</h2>
        {trades.length === 0 ? (
          <p className="text-xs text-zinc-600">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Ticker</th>
                  <th className="pb-2 pr-4">Strategy</th>
                  <th className="pb-2 pr-4">Legs</th>
                  <th className="pb-2 pr-4">Credit/Debit</th>
                  <th className="pb-2 pr-4">Max Loss</th>
                  <th className="pb-2 pr-4">Max Profit</th>
                  <th className="pb-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-900">
                    <td className="py-2 pr-4 font-medium">{t.ticker}</td>
                    <td className="py-2 pr-4 text-zinc-400">{t.strategy}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-zinc-400">
                      {t.legs.map((l) => `${l.side} ${l.right} ${l.strike}`).join(" / ")}
                    </td>
                    <td className="py-2 pr-4">{t.creditDebit} {money(t.netPremium)}</td>
                    <td className="py-2 pr-4 text-red-400">{money(t.maxLoss)}</td>
                    <td className="py-2 pr-4 text-emerald-400">{money(t.maxProfit)}</td>
                    <td className="py-2 pr-4"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Decision Log</h2>
        {decisions.length === 0 ? (
          <p className="text-xs text-zinc-600">No decisions yet.</p>
        ) : (
          <ul className="space-y-2">
            {decisions.map((d) => (
              <li key={d.id} className="border-t border-zinc-900 pt-2 text-sm">
                <span className="font-medium">{d.ticker}</span>{" "}
                <span className={d.direction === "BUY" ? "text-emerald-400" : d.direction === "SELL" ? "text-red-400" : "text-zinc-400"}>
                  {d.direction}
                </span>{" "}
                <span className="text-xs text-zinc-500">confidence {d.confidence.toFixed(1)} · {d.runDate}</span>
                <p className="mt-1 text-xs text-zinc-500">{d.summary.slice(0, 240)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Risk Gate Log</h2>
        {riskEvents.length === 0 ? (
          <p className="text-xs text-zinc-600">No risk-gate events yet.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {riskEvents.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span className={e.passed ? "text-emerald-400" : "text-red-400"}>{e.passed ? "PASS" : "FAIL"}</span>
                <span className="text-zinc-400">{e.gateName}:</span>
                <span className="text-zinc-500">{e.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Live activity feed</h2>
        {events.length === 0 ? (
          <p className="text-xs text-zinc-600">waiting for broadcasts…</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {events.map((e, i) => (
              <li key={i} className="text-emerald-400">{e}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
