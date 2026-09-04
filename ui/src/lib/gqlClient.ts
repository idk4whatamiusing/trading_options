// Raw GraphQL client - zero dependencies.
// POST for query/mutation, a ~60-line graphql-transport-ws implementation
// for subscriptions. No auth: single-user dashboard over the trading
// agent's persisted state.

export interface GqlClient {
  graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
  subscribe<T>(
    query: string,
    variables: Record<string, unknown> | undefined,
    onNext: (data: T) => void,
    onError?: (err: unknown) => void,
  ): () => void;
}

export function createClient(baseURL = ""): GqlClient {
  const base = baseURL.replace(/\/$/, "");

  async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const r = await fetch(`${base}/api/graphql`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json();
    if (j.errors?.length) throw new Error(j.errors[0].message);
    return j.data as T;
  }

  function wsURL(): string {
    if (base) {
      return base.replace(/^http/, "ws") + "/api/graphql";
    }
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/api/graphql`;
  }

  function subscribe<T>(
    query: string,
    variables: Record<string, unknown> | undefined,
    onNext: (data: T) => void,
    onError?: (err: unknown) => void,
  ): () => void {
    const ws = new WebSocket(wsURL(), "graphql-transport-ws");
    const id = Math.random().toString(36).slice(2);
    let closedByUs = false;

    ws.onopen = () => ws.send(JSON.stringify({ type: "connection_init", payload: {} }));
    ws.onerror = (e) => onError?.(e);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string);
      switch (msg.type) {
        case "connection_ack":
          ws.send(JSON.stringify({ id, type: "subscribe", payload: { query, variables } }));
          break;
        case "next":
          onNext(msg.payload.data as T);
          break;
        case "error":
          onError?.(msg.payload);
          break;
        case "complete":
          if (!closedByUs) ws.close();
          break;
      }
    };
    return () => {
      closedByUs = true;
      try {
        ws.send(JSON.stringify({ id, type: "complete" }));
      } catch {
        /* socket may be gone */
      }
      ws.close();
    };
  }

  return { graphql, subscribe };
}

// ---- shared queries/mutations ----

export const LATEST_SNAPSHOT = `{
  latestSnapshot { equity cash buyingPower optionsBuyingPower dayPnl openPositionsCount createdAt }
}`;

export const TRADES = `query ($status: String) {
  trades(status: $status, limit: 50) {
    id ticker strategy expiry quantity creditDebit netPremium maxProfit maxLoss
    status alpacaOrderId realizedPnl rationale createdAt
    legs { side right strike expiry symbol ratioQty }
  }
}`;

export const OPEN_TRADES = `query {
  trades(status: "open", limit: 50) {
    id ticker strategy expiry quantity creditDebit netPremium maxProfit maxLoss
    status alpacaOrderId realizedPnl rationale createdAt openedAt
    legs { side right strike expiry symbol ratioQty }
  }
}`;

export const ALL_TRADES = `query ($status: String, $limit: Int) {
  trades(status: $status, limit: $limit) {
    id ticker strategy expiry quantity creditDebit netPremium maxProfit maxLoss
    status alpacaOrderId realizedPnl rationale createdAt openedAt closedAt
    legs { side right strike expiry symbol ratioQty }
  }
}`;

export const DECISIONS = `{
  decisions(limit: 50) { id ticker runDate direction confidence summary fullReport createdAt }
}`;

export const RISK_GATE_EVENTS = `{
  riskGateEvents(limit: 100) { id tradeId gateName passed reason createdAt }
}`;

export const ACCOUNT_SNAPSHOTS = `query ($limit: Int) {
  accountSnapshots(limit: $limit) { id equity cash buyingPower optionsBuyingPower dayPnl openPositionsCount createdAt }
}`;

export const RUN_CYCLE = `mutation ($tickers: [String!]) {
  runCycle(tickers: $tickers)
}`;

export const EVENTS = `subscription {
  events
}`;

export const BROADCAST = `mutation ($message: String!) {
  broadcast(message: $message)
}`;

export interface Leg {
  side: string;
  right: string;
  strike: number;
  expiry: string;
  symbol: string;
  ratioQty: number;
}

export interface Trade {
  id: string;
  ticker: string;
  strategy: string;
  expiry: string;
  quantity: number;
  creditDebit: string;
  netPremium: number;
  maxProfit: number;
  maxLoss: number;
  status: string;
  alpacaOrderId?: string | null;
  realizedPnl?: number | null;
  rationale?: string | null;
  createdAt: string;
  openedAt?: string | null;
  closedAt?: string | null;
  legs: Leg[];
}

export interface Decision {
  id: string;
  ticker: string;
  runDate: string;
  direction: string;
  confidence: number;
  summary: string;
  fullReport?: string | null;
  createdAt: string;
}

export interface RiskGateEvent {
  id: string;
  tradeId?: string | null;
  gateName: string;
  passed: boolean;
  reason: string;
  createdAt: string;
}

export interface AccountSnapshot {
  equity: number;
  cash: number;
  buyingPower: number;
  optionsBuyingPower?: number | null;
  dayPnl?: number | null;
  openPositionsCount: number;
  createdAt: string;
}
