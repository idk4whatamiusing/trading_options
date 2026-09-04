"use client";

import { useEffect, useState } from "react";
import { Activity, Layers, ShieldCheck, Wallet, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createClient,
  LATEST_SNAPSHOT,
  TRADES,
  type AccountSnapshot,
  type Trade,
} from "@/lib/gqlClient";

const STARTING_EQUITY = 100_000;
const MAX_POSITIONS = 10;

function fmtMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number) {
  const s = n >= 0 ? "+" : "";
  return `${s}${(n * 100).toFixed(1)}%`;
}

export function MetricCards() {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const [snapRes, tradesRes] = await Promise.all([
          client.graphql<{ latestSnapshot: AccountSnapshot | null }>(LATEST_SNAPSHOT),
          client.graphql<{ trades: Trade[] }>(TRADES, { status: "open" }),
        ]);
        if (!cancelled) {
          setSnapshot(snapRes.latestSnapshot);
          setOpenTrades(tradesRes.trades ?? []);
        }
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const equity = snapshot?.equity ?? STARTING_EQUITY;
  const dayPnl = snapshot?.dayPnl ?? 0;
  const buyingPower = snapshot?.buyingPower ?? null;
  const openCount = snapshot?.openPositionsCount ?? openTrades.length ?? 0;
  const equityDelta = (equity - STARTING_EQUITY) / STARTING_EQUITY;
  const dayPnlPct = equity ? dayPnl / equity : 0;
  const riskUsed = openTrades.reduce((acc, t) => acc + (t.maxLoss ?? 0), 0);
  const riskCap = equity * 0.35;
  const riskPct = riskCap > 0 ? riskUsed / riskCap : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>
                <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <Wallet className="size-4" />
                </div>
              </CardTitle>
              <CardDescription>Loading…</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">—</div>
              <p className="text-muted-foreground text-sm">Fetching snapshot</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Wallet className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Portfolio Equity</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {fmtMoney(equity)}
            </div>
            <Badge variant={equityDelta >= 0 ? "default" : "destructive"}>
              {equityDelta >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {fmtPct(equityDelta)}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Cash {fmtMoney(snapshot?.cash)} · BP {fmtMoney(buyingPower)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Activity className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Day P&L</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {fmtMoney(dayPnl)}
            </div>
            <Badge variant={dayPnl >= 0 ? "default" : "destructive"}>
              {dayPnl >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {fmtPct(dayPnlPct)}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Daily breaker -3% · 5d -6%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Layers className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Open Positions</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {openCount} / {MAX_POSITIONS}
            </div>
            <Badge variant={openCount >= MAX_POSITIONS ? "destructive" : "outline"}>
              {openCount >= MAX_POSITIONS ? "At limit" : `${MAX_POSITIONS - openCount} slots left`}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">2 per ticker max · DTE 5–30</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <ShieldCheck className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Risk Budget Used</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">
              {fmtMoney(riskUsed)} / {fmtMoney(riskCap)}
            </div>
            <Badge variant={riskPct > 0.95 ? "destructive" : riskPct > 0.8 ? "outline" : "default"}>
              {(riskPct * 100).toFixed(0)}%
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">35% aggregate cap · 8% per trade</p>
        </CardContent>
      </Card>
    </div>
  );
}
