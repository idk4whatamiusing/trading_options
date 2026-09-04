"use client";

import { useEffect, useState, useRef } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, EVENTS } from "@/lib/gqlClient";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";

interface FeedEvent {
  data: string;
  timestamp: string;
}

export function LiveEventFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const client = createClient();
    let cancelled = false;

    const unsub = client.subscribe<string>(
      EVENTS,
      undefined,
      (data) => {
        if (!cancelled) {
          setEvents((prev) => [
            { data: data as string, timestamp: new Date().toISOString() },
            ...prev.slice(0, 199),
          ]);
          setConnected(true);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("Subscription error:", err);
          setConnected(false);
        }
      },
    );
    wsRef.current = unsub;

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const recentCount = events.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Live Feed</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={connected ? "default" : "destructive"}>
                <Radio className="size-2 mr-1 animate-pulse" />
                {connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentCount}</div>
            <p className="text-xs text-muted-foreground">Events received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Channel</CardTitle>
            <Badge variant="outline">Realtime</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">WebSocket</div>
            <p className="text-xs text-muted-foreground">graphql-transport-ws</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Stream</CardTitle>
          <CardDescription>Real-time events from the Alpaca agent</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
            {events.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                Waiting for events…
              </div>
            ) : (
              events.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground font-mono text-xs">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="font-medium">{e.data}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
