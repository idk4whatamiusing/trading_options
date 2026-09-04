"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient, TRADES, type Trade } from "@/lib/gqlClient";

import { RecentCustomersTable } from "./recent-customers-table/table";
import type { RecentTradeRow } from "./recent-customers-table/schema";

export function SubscriberOverview() {
  const [trades, setTrades] = useState<RecentTradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const res = await client.graphql<{ trades: Trade[] }>(TRADES);
        if (!cancelled) {
          const rows = (res.trades ?? []).map((t) => ({
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
          setTrades(rows);
        }
      } catch {
        // keep empty, table shows No trades yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCount = trades.filter((t) => t.status === "open").length;
  const title = loading ? "Trades" : `Trades (${openCount} open / ${trades.length} total)`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">{title}</CardTitle>
        <CardDescription>
          Recent Alpaca paper trades — strategy, credit/debit, risk, and expiry — filtered by status
          and DTE.
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            <Download />
            Export
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <RecentCustomersTable data={trades} />
      </CardContent>
    </Card>
  );
}
