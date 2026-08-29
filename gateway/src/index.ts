import { Hono } from "hono";

// Static assets (the Next.js export) are served directly by Cloudflare's
// assets layer and never reach this script. This worker only exists as a
// fallback for a route that matches neither a static file nor a Next.js
// route - there is no /api/* proxy here (see wrangler.toml) since the UI
// talks directly, cross-origin, to the AWS-hosted api service.
const app = new Hono();

app.all("*", (c) => c.text("not found", 404));

export default app;
