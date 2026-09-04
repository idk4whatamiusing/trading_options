import { Hono } from "hono";

// Assets (ui/out) are served by Cloudflare's asset layer before this worker runs.
// This is only the SPA fallback — e.g. /dashboard/trades deep links.
const app = new Hono();

app.get("*", (c) => c.text("not found", 404));

export default app;
