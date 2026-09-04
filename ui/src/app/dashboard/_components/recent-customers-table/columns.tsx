"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { differenceInCalendarDays, endOfToday, format, parseISO } from "date-fns";
import { CircleAlertIcon, CircleCheckIcon, Clock3Icon, LoaderIcon, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { DataTableFeatures } from "@/lib/data-table-features";

import type { RecentTradeRow } from "./schema";

function statusIcon(status: string) {
  switch (status) {
    case "open":
      return <LoaderIcon className="size-3 animate-spin" />;
    case "closed":
      return (
        <CircleCheckIcon className="fill-green-500 stroke-primary-foreground dark:fill-green-600 size-3" />
      );
    case "rejected":
    case "failed":
      return <CircleAlertIcon className="text-amber-600 dark:text-amber-500 size-3" />;
    default:
      return <Clock3Icon className="text-muted-foreground size-3" />;
  }
}

function creditDebitIcon(side: string) {
  if (side === "credit")
    return (
      <CircleCheckIcon className="fill-green-500 stroke-primary-foreground dark:fill-green-600 size-3" />
    );
  if (side === "debit") return <CircleAlertIcon className="text-amber-600 size-3" />;
  return null;
}

export const recentCustomersColumns: ColumnDef<DataTableFeatures, RecentTradeRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Subscribe
          source={table.atoms.rowSelection}
          selector={() =>
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() &&
              !table.getIsAllPageRowsSelected() &&
              "indeterminate")
          }
        >
          {(checked) => (
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all trades on this page"
            />
          )}
        </Subscribe>
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Subscribe
          source={row.table.atoms.rowSelection}
          selector={(selection) => Boolean(selection?.[row.id])}
        >
          {(checked) => (
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={`Select ${row.original.ticker} ${row.original.strategy}`}
            />
          )}
        </Subscribe>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "ticker",
    header: "Position",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
          <TrendingUp className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-end justify-between gap-3">
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium text-sm leading-none">
                {row.original.ticker} · {row.original.strategy.replace(/_/g, " ")}
              </span>
              <span className="truncate text-muted-foreground text-xs leading-none">
                #{row.original.id.slice(0, 7)} · {row.original.legs.length} legs
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    enableHiding: false,
  },
  {
    id: "search",
    accessorFn: (row) =>
      `${row.id} ${row.ticker} ${row.strategy} ${row.legs.map((l) => l.symbol).join(" ")}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {statusIcon(row.original.status)}
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "creditDebit",
    header: "Side",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {creditDebitIcon(row.original.creditDebit)}
        {row.original.creditDebit}{" "}
        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
          row.original.netPremium,
        )}
      </Badge>
    ),
  },
  {
    accessorKey: "strategy",
    header: "Strategy",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <span className="text-sm capitalize">{row.original.strategy.replace(/_/g, " ")}</span>
    ),
  },
  {
    id: "expiryWindow",
    accessorFn: (row) => {
      const dte = differenceInCalendarDays(parseISO(row.expiry), endOfToday());
      if (dte <= 3) return ["expiring", "7", "30"];
      if (dte <= 7) return ["7", "30"];
      if (dte <= 30) return ["30"];
      return [];
    },
    filterFn: "arrIncludes",
    enableHiding: true,
  },
  {
    accessorKey: "expiry",
    header: "Expiry",
    cell: ({ row }) => {
      const expiry = parseISO(row.original.expiry);
      const dte = differenceInCalendarDays(expiry, endOfToday());
      const dteLabel = dte < 0 ? "expired" : `DTE ${dte}`;
      const dteColor = dte <= 3 || dte < 5 || dte > 30 ? "text-amber-600" : "text-muted-foreground";
      return (
        <div className="grid gap-0.5">
          <span className="text-sm">{format(expiry, "do MMM yyyy")}</span>
          <span className={`text-xs ${dteColor}`}>
            {dteLabel} · {row.original.quantity}×
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "realizedPnl",
    header: "P&L",
    cell: ({ row }) => {
      const v = row.original.realizedPnl;
      if (v == null) return <span className="text-muted-foreground text-sm">—</span>;
      const isPos = v >= 0;
      return (
        <span className={`text-sm tabular-nums ${isPos ? "text-green-600" : "text-destructive"}`}>
          {isPos ? "+" : ""}
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v)}
        </span>
      );
    },
  },
];
