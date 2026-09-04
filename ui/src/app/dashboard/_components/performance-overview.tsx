"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Area, CartesianGrid, ComposedChart, Line, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_SNAPSHOTS, createClient, type AccountSnapshot } from "@/lib/gqlClient";

const chartConfig = {
  equity: {
    label: "Equity",
    color: "var(--chart-1)",
  },
  buyingPower: {
    label: "Buying Power",
    color: "var(--chart-2)",
  },
  optionsBuyingPower: {
    label: "Options BP",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function PerformanceOverview() {
  const [snapshots, setSnapshots] = useState<AccountSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const res = await client.graphql<{ accountSnapshots: AccountSnapshot[] }>(
          ACCOUNT_SNAPSHOTS,
          { limit: 100 },
        );
        if (!cancelled) setSnapshots(res.accountSnapshots ?? []);
      } catch {
        // fallback to empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData =
    snapshots.length > 0
      ? [...snapshots].reverse().map((s) => ({
          date: format(parseISO(s.createdAt), "yyyy-MM-dd"),
          equity: s.equity,
          buyingPower: s.buyingPower,
          optionsBuyingPower: s.optionsBuyingPower ?? 0,
        }))
      : [];

  const isEmpty = !loading && chartData.length === 0;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">Portfolio Performance</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Equity &amp; buying power for the last 100 snapshots
          </span>
          <span className="@[540px]/card:hidden">Last 100 snapshots</span>
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select defaultValue="all">
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Timeframe</SelectLabel>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="30">Last 30</SelectItem>
                <SelectItem value="90">Last 90</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Overlay" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Overlay</SelectLabel>
                <SelectItem value="all">Buying Power</SelectItem>
                <SelectItem value="options">Options BP</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            View risk gates
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {isEmpty ? (
          <div className="flex h-80 w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No snapshots yet — equity starts at $100k paper. Run a cycle.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
            <ComposedChart data={chartData} margin={{ top: 0 }}>
              <defs>
                <linearGradient id="fillEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-equity)" stopOpacity={0.36} />
                  <stop offset="95%" stopColor="var(--color-equity)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={48}
                tickFormatter={(value) =>
                  parseISO(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
              />

              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    className="w-50"
                    indicator="line"
                    labelFormatter={(value) => format(parseISO(value), "d MMMM yyyy")}
                  />
                }
              />
              <ChartLegend
                verticalAlign="top"
                content={<ChartLegendContent className="mb-5 justify-end" />}
              />

              <Area
                dataKey="equity"
                type="natural"
                fill="url(#fillEquity)"
                stroke="var(--color-equity)"
                strokeWidth={1.25}
                dot={false}
                fillOpacity={1}
              />
              <Line
                dataKey="buyingPower"
                type="natural"
                stroke="var(--color-buyingPower)"
                strokeWidth={1.4}
                dot={false}
              />
              <Line
                dataKey="optionsBuyingPower"
                type="natural"
                stroke="var(--color-optionsBuyingPower)"
                strokeWidth={1.2}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
