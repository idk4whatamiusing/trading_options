"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, LATEST_SNAPSHOT, type AccountSnapshot } from "@/lib/gqlClient";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, ShieldCheck, Clock, ArrowRightLeft, Percent } from "lucide-react";

export function AccountDetails() {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const res = await client.graphql<{ latestSnapshot: AccountSnapshot | null }>(
          LATEST_SNAPSHOT,
        );
        if (!cancelled) setSnapshot(res.latestSnapshot);
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

  if (loading || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            Loading account…
          </div>
        </CardContent>
      </Card>
    );
  }

  const equity = snapshot.equity;
  const dayPnl = snapshot.dayPnl ?? 0;
  const dayPnlPct = equity ? dayPnl / equity : 0;
  const optionsBuyingPower = snapshot.optionsBuyingPower ?? 0;
  const equityDelta = (equity - 100000) / 100000;
  const riskUsed = 15000;
  const riskCap = equity * 0.35;
  const riskPct = riskCap > 0 ? riskUsed / riskCap : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Equity</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${equity.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={equityDelta >= 0 ? "default" : "destructive"}>
                {equityDelta >= 0 ? "+" : ""}
                {(equityDelta * 100).toFixed(1)}%
              </Badge>
              <span className="text-xs text-muted-foreground">${dayPnl.toFixed(0)} day</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Buying Power</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${snapshot.buyingPower.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Options BP: ${optionsBuyingPower.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Risk Budget</CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(riskPct * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              ${riskUsed.toLocaleString()} / ${riskCap.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Account Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Open Positions</span>
              <span className="font-medium">{snapshot.openPositionsCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cash</span>
              <span className="font-medium">${snapshot.cash.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Equity</span>
              <span className="font-medium">${equity.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Day P&L</span>
              <span
                className={`font-medium ${dayPnl >= 0 ? "text-green-600" : "text-destructive"}`}
              >
                ${dayPnl.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Options BP</span>
              <span className="font-medium">${optionsBuyingPower.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Max Positions</span>
              <span className="font-medium">10</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Risk Limits</CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Aggregate Cap</span>
              <span className="font-medium">35%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Per Trade Max</span>
              <span className="font-medium">8%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Max Positions</span>
              <span className="font-medium">10</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Max Per Ticker</span>
              <span className="font-medium">2</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">DTE Range</span>
              <span className="font-medium">5–30 days</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Paper Balance</span>
              <span className="font-medium">$100,000</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
