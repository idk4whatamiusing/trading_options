"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, OPEN_TRADES, type Trade } from "@/lib/gqlClient";
import { format, parseISO } from "date-fns";
import { differenceInCalendarDays, endOfToday } from "date-fns";
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

function creditDebitIcon(side: string) {
  if (side === "credit") return "💰";
  if (side === "debit") return "💸";
  return null;
}

export function TradeExecutionTable() {
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

  const totalCredit = trades.reduce((a, t) => a + (t.netPremium ?? 0), 0);
  const totalRisk = trades.reduce((a, t) => a + (t.maxLoss ?? 0), 0);
  const totalProfit = trades.reduce((a, t) => a + (t.maxProfit ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Trades</CardTitle>
            <Badge variant="default">{trades.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCredit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Net credit/debit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Max Profit</CardTitle>
            <Badge variant="default">+{totalProfit.toFixed(2)}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalProfit.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Aggregate max gain</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Max Risk</CardTitle>
            <Badge variant="destructive">${totalRisk.toFixed(0)}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${totalRisk.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Aggregate max loss</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade Execution Log</CardTitle>
          <CardDescription>
            Currently open Alpaca paper trades — filtered by status and expiry
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <RecentCustomersTable data={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
