"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Area, CartesianGrid, ComposedChart, Line, XAxis } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  createClient,
  ACCOUNT_SNAPSHOTS,
  DECISIONS,
  RISK_GATE_EVENTS,
  type AccountSnapshot,
  type Decision,
  type RiskGateEvent,
} from "@/lib/gqlClient";

const chartConfig = {
  equity: { label: "Equity", color: "var(--chart-1)" },
  buyingPower: { label: "Buying Power", color: "var(--chart-2)" },
  cash: { label: "Cash", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ReportsPanel() {
  const [snapshots, setSnapshots] = useState<AccountSnapshot[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [gateEvents, setGateEvents] = useState<RiskGateEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const [snapRes, decRes, gateRes] = await Promise.all([
          client.graphql<{ accountSnapshots: AccountSnapshot[] }>(ACCOUNT_SNAPSHOTS, {
            limit: 100,
          }),
          client.graphql<{ decisions: Decision[] }>(DECISIONS),
          client.graphql<{ riskGateEvents: RiskGateEvent[] }>(RISK_GATE_EVENTS),
        ]);
        if (!cancelled) {
          setSnapshots(snapRes.accountSnapshots ?? []);
          setDecisions(decRes.decisions ?? []);
          setGateEvents(gateRes.riskGateEvents ?? []);
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

  const chartData = snapshots
    .slice()
    .reverse()
    .map((s) => ({
      date: format(parseISO(s.createdAt), "yyyy-MM-dd"),
      equity: s.equity,
      buyingPower: s.buyingPower,
      cash: s.cash,
    }));

  const totalPnl =
    snapshots.length > 1 ? snapshots[snapshots.length - 1].equity - snapshots[0].equity : 0;
  const totalDecisions = decisions.length;
  const buyDecisions = decisions.filter((d) => d.direction === "buy").length;
  const sellDecisions = decisions.filter((d) => d.direction === "sell").length;
  const gatePassed = gateEvents.filter((e) => e.passed).length;
  const gateFailed = gateEvents.filter((e) => !e.passed).length;
  const avgConfidence = decisions.length
    ? decisions.reduce((a, d) => a + d.confidence, 0) / decisions.length
    : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reports & Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading reports…
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalPnl >= 0 ? "text-green-600" : "text-destructive"}`}
            >
              ${totalPnl.toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">Since inception</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDecisions}</div>
            <p className="text-xs text-muted-foreground">
              {buyDecisions} buy · {sellDecisions} sell
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgConfidence * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Across all</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gate Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {gateEvents.length ? `${((gatePassed / gateEvents.length) * 100).toFixed(0)}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {gatePassed} passed · {gateFailed} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="leading-none">Performance Timeline</CardTitle>
            <CardDescription>Equity, buying power &amp; cash over time</CardDescription>
            <CardAction className="flex items-center gap-2">
              <Select defaultValue="all">
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue placeholder="Overlay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="size-3 mr-2" />
                Export
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
              <ComposedChart data={chartData} margin={{ top: 0 }}>
                <defs>
                  <linearGradient id="fillEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-equity)" stopOpacity={0.36} />
                    <stop offset="95%" stopColor="var(--color-equity)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) => format(parseISO(v), "d MMMM yyyy")}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent className="mb-5 justify-end" />} />
                <Area
                  type="natural"
                  dataKey="equity"
                  fill="url(#fillEquity)"
                  stroke="var(--color-equity)"
                  strokeWidth={1.25}
                  dot={false}
                  fillOpacity={1}
                />
                <Line
                  type="natural"
                  dataKey="buyingPower"
                  stroke="var(--color-buyingPower)"
                  strokeWidth={1.4}
                  dot={false}
                />
                <Line
                  type="natural"
                  dataKey="cash"
                  stroke="var(--color-cash)"
                  strokeWidth={1.2}
                  dot={false}
                />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
