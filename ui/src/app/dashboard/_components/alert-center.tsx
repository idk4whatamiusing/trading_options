"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createClient,
  RISK_GATE_EVENTS,
  TRADES,
  type RiskGateEvent,
  type Trade,
} from "@/lib/gqlClient";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, Clock } from "lucide-react";

export function AlertCenter() {
  const [gateEvents, setGateEvents] = useState<RiskGateEvent[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const [gateRes, tradesRes] = await Promise.all([
          client.graphql<{ riskGateEvents: RiskGateEvent[] }>(RISK_GATE_EVENTS),
          client.graphql<{ trades: Trade[] }>(TRADES),
        ]);
        if (!cancelled) {
          setGateEvents(gateRes.riskGateEvents ?? []);
          setTrades(tradesRes.trades ?? []);
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

  const failedGates = gateEvents.filter((e) => !e.passed);
  const rejectedTrades = trades.filter((t) => t.status === "rejected" || t.status === "failed");
  const totalAlerts = failedGates.length + rejectedTrades.length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4" /> Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            Loading alerts…
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{totalAlerts}</div>
            <p className="text-xs text-muted-foreground">Active issues</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gate Failures</CardTitle>
            <ShieldAlert className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{failedGates.length}</div>
            <p className="text-xs text-muted-foreground">Blocked trades</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rejected Orders</CardTitle>
            <Clock className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{rejectedTrades.length}</div>
            <p className="text-xs text-muted-foreground">Failed trades</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alert Log</CardTitle>
          <CardDescription>
            Failed gate checks and rejected orders requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-2">
            {totalAlerts === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                No alerts. All systems clear.
              </div>
            ) : (
              <>
                {failedGates.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-md border border-destructive/20 px-4 py-3 text-sm"
                  >
                    <ShieldAlert className="size-4 text-destructive shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium">{e.gateName}</span>
                      <p className="text-xs text-muted-foreground">{e.reason}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
                {rejectedTrades.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-md border border-amber-500/20 px-4 py-3 text-sm"
                  >
                    <Clock className="size-4 text-amber-600 shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium">
                        {t.ticker} · {t.strategy.replace(/_/g, " ")}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Status: {t.status} · {t.creditDebit} ${t.netPremium.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
