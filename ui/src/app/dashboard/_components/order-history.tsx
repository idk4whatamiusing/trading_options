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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient, ALL_TRADES, type Trade } from "@/lib/gqlClient";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

const statusColors: Record<string, string> = {
  open: "default",
  closed: "secondary",
  rejected: "destructive",
  failed: "destructive",
};

const sideColors: Record<string, string> = {
  credit: "default",
  debit: "outline",
};

export function OrderHistory() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      try {
        const status = statusFilter === "all" ? undefined : statusFilter;
        const res = await client.graphql<{ trades: Trade[] }>(ALL_TRADES, {
          status,
          limit: 50,
        });
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
  }, [statusFilter]);

  const openCount = trades.filter((t) => t.status === "open").length;
  const closedCount = trades.filter((t) => t.status === "closed").length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            Loading orders…
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <CardDescription>
          {openCount} open · {closedCount} closed · {trades.length} total
        </CardDescription>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-0">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Net Premium</TableHead>
                  <TableHead>Max P&L</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  trades.slice(0, 30).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        #{t.id.slice(0, 7)} · {t.ticker}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (statusColors[t.status] ?? "outline") as
                              "default" | "outline" | "destructive" | "secondary" | "link" | null
                          }
                        >
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (sideColors[t.creditDebit] ?? "outline") as
                              "default" | "outline" | "destructive" | "secondary" | "link" | null
                          }
                        >
                          {t.creditDebit}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{t.strategy.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-sm">
                        {format(parseISO(t.expiry), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        ${t.netPremium.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        ${t.maxProfit.toFixed(0)} / -${t.maxLoss.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(t.createdAt), "MMM d, HH:mm")}
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
