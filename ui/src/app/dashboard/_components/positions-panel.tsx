"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, OPEN_TRADES, type Trade } from "@/lib/gqlClient";
import { format, parseISO } from "date-fns";
import { differenceInCalendarDays, endOfToday } from "date-fns";
import { ArrowLeftRight, Clock, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecentCustomersTable } from "./recent-customers-table/table";
import type { RecentTradeRow } from "./recent-customers-table/schema";

export function PositionsPanel() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const res = await client.graphql<{ trades: Trade[] }>(OPEN_TRADES);
        if (!cancelled) setTrades(res.trades ?? []);
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

  const rows: RecentTradeRow[] = trades.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    strategy: t.strategy,
    status: t.status,
    creditDebit: t.creditDebit,
    quantity: t.quantity,
    netPremium: t.netPremium,
    maxLoss: t.maxLoss,
    maxProfit: t.maxProfit,
    realizedPnl: t.realizedPnl ?? null,
    expiry: t.expiry,
    legs: t.legs,
    createdAt: t.createdAt,
  }));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-4" /> Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            Loading positions…
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRisk = trades.reduce((a, t) => a + (t.maxLoss ?? 0), 0);
  const totalCredit = trades.reduce((a, t) => a + (t.netPremium ?? 0), 0);
  const totalMaxProfit = trades.reduce((a, t) => a + (t.maxProfit ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
            <Target className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trades.length}</div>
            <p className="text-xs text-muted-foreground">2 per ticker max</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Max Risk</CardTitle>
            <TrendingUp className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRisk.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Aggregate max loss</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Max Profit</CardTitle>
            <ArrowLeftRight className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalMaxProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Aggregate max gain</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open Positions Detail</CardTitle>
          <CardDescription>Active trades with strikes, expiry, and legs</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <RecentCustomersTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
