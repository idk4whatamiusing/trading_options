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
import { createClient, RISK_GATE_EVENTS, type RiskGateEvent } from "@/lib/gqlClient";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, XCircle, Clock } from "lucide-react";

function statusIcon(passed: boolean) {
  if (passed) return <ShieldCheck className="size-4 text-green-600" />;
  return <ShieldAlert className="size-4 text-destructive" />;
}

export function RiskGateLog() {
  const [events, setEvents] = useState<RiskGateEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const res = await client.graphql<{ riskGateEvents: RiskGateEvent[] }>(RISK_GATE_EVENTS);
        if (!cancelled) setEvents(res.riskGateEvents ?? []);
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

  const passedCount = events.filter((e) => e.passed).length;
  const failedCount = events.filter((e) => !e.passed).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> Risk Gates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            Loading risk gates…
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
            <CardTitle className="text-sm">Total Events</CardTitle>
            <ShieldCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs text-muted-foreground">All gate checks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Passed</CardTitle>
            <ShieldCheck className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passedCount}</div>
            <p className="text-xs text-muted-foreground">Safe to trade</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Failed</CardTitle>
            <ShieldAlert className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{failedCount}</div>
            <p className="text-xs text-muted-foreground">Blocked trades</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gate Event Log</CardTitle>
          <CardDescription>Deterministic risk gate audit trail</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No gate events yet. Run a cycle.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.slice(0, 50).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.gateName}</TableCell>
                      <TableCell>{statusIcon(e.passed)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {e.reason}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
