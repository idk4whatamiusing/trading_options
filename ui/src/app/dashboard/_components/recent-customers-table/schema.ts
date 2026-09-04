import z from "zod";

export const recentTradeSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  strategy: z.string(),
  status: z.string(),
  creditDebit: z.string(),
  quantity: z.number(),
  netPremium: z.number(),
  maxLoss: z.number(),
  maxProfit: z.number(),
  realizedPnl: z.number().nullable().optional(),
  expiry: z.string(),
  legs: z.array(
    z.object({
      side: z.string(),
      right: z.string(),
      strike: z.number(),
      expiry: z.string(),
      symbol: z.string(),
      ratioQty: z.number(),
    }),
  ),
  createdAt: z.string(),
});

export type RecentTradeRow = z.infer<typeof recentTradeSchema>;
// Keep alias for backwards compat where RecentCustomerRow was imported
export type RecentCustomerRow = RecentTradeRow;
