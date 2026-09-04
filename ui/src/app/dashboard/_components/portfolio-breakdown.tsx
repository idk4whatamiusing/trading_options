"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  createClient,
  LATEST_SNAPSHOT,
  ACCOUNT_SNAPSHOTS,
  type AccountSnapshot,
} from "@/lib/gqlClient";
import { format, parseISO } from "date-fns";

export function PortfolioBreakdown() {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [history, setHistory] = useState<AccountSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const [snapRes, histRes] = await Promise.all([
          client.graphql<{ latestSnapshot: AccountSnapshot | null }>(LATEST_SNAPSHOT),
          client.graphql<{ accountSnapshots: AccountSnapshot[] }>(ACCOUNT_SNAPSHOTS, { limit: 30 }),
        ]);
        if (!cancelled) {
          setSnapshot(snapRes.latestSnapshot);
          setHistory(histRes.accountSnapshots ?? []);
        }
      } catch {
        // keep empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = history
    .slice()
    .reverse()
    .map((s) => ({
      date: format(parseISO(s.createdAt), "MMM d"),
      equity: s.equity,
      cash: s.cash,
    }));

  if (loading || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading portfolio…
          </div>
        </CardContent>
      </Card>
    );
  }

  const equity = snapshot.equity;
  const cashPct = equity > 0 ? (snapshot.cash / equity) * 100 : 0;
  const optionsPct = equity > 0 ? ((snapshot.equity - snapshot.cash) / equity) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${equity.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +${(snapshot.dayPnl ?? 0).toLocaleString()} today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${snapshot.cash.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{cashPct.toFixed(0)}% of equity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(snapshot.equity - snapshot.cash).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{optionsPct.toFixed(0)}% of equity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Buying Power</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${snapshot.buyingPower.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Equity vs Cash</CardTitle>
            <CardDescription>Last 30 snapshots</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeOpacity={0.5} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip />
                <Bar dataKey="equity" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cash" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
