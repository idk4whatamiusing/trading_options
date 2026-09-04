"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, DECISIONS, RUN_CYCLE, type Decision } from "@/lib/gqlClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, TrendingUp, ShieldCheck, AlertTriangle } from "lucide-react";

export function DecisionScanner() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const res = await client.graphql<{ decisions: Decision[] }>(DECISIONS);
        if (!cancelled) setDecisions(res.decisions ?? []);
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

  const runCycle = async () => {
    setRunning(true);
    try {
      const client = createClient();
      await client.graphql<{ runCycle: string }>(RUN_CYCLE, { tickers: [] });
    } catch {
      // ignore
    } finally {
      setRunning(false);
    }
  };

  const buyCount = decisions.filter((d) => d.direction === "buy").length;
  const sellCount = decisions.filter((d) => d.direction === "sell").length;
  const avgConfidence = decisions.length
    ? decisions.reduce((a, d) => a + d.confidence, 0) / decisions.length
    : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Market Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            Loading decisions…
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Decisions</CardTitle>
            <Sparkles className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{decisions.length}</div>
            <p className="text-xs text-muted-foreground">AI-generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Avg Confidence</CardTitle>
            <TrendingUp className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgConfidence * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Across all</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Buy Signals</CardTitle>
            <ArrowRight className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{buyCount}</div>
            <p className="text-xs text-muted-foreground">{sellCount} sell</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">High Confidence</CardTitle>
            <ShieldCheck className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {decisions.filter((d) => d.confidence > 0.7).length}
            </div>
            <p className="text-xs text-muted-foreground">{">"}70% confidence</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <CardDescription>AI trading decisions from Cloudflare Workers AI</CardDescription>
        <Button variant="outline" size="sm" onClick={runCycle} disabled={running}>
          <Sparkles className="size-4 mr-2" />
          {running ? "Running…" : "Run Cycle"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Decision Log</CardTitle>
          <CardDescription>
            Recent AI-generated trading decisions with confidence scores
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-2">
            {decisions.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                No decisions yet. Run a cycle to generate signals.
              </div>
            ) : (
              decisions.slice(0, 20).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={d.direction === "buy" ? "default" : "destructive"}
                      className="w-16 justify-center"
                    >
                      {d.direction}
                    </Badge>
                    <span className="font-medium">{d.ticker}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{(d.confidence * 100).toFixed(0)}%</span>
                    <span className="text-xs">{new Date(d.runDate).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
