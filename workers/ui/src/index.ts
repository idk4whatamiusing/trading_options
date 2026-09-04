import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  API_ORIGIN: string;
};

type SessionUser = {
  email: string;
  name: string;
  picture: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const SESSION_COOKIE = "alpaca_session";

function redirectUri(c: { req: { url: string } }): string {
  return `${new URL(c.req.url).origin}/api/auth/google/callback`;
}

// --- Google OAuth (server-side authorization-code flow: we hold the client
// secret, so the id_token comes back over a trusted server-to-server call to
// Google's token endpoint - no client-supplied-token verification needed,
// unlike the implicit/GIS-popup flow). ---

app.get("/api/auth/google/start", (c) => {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri(c));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  return c.redirect(url.toString());
});

app.get("/api/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.text("missing code", 400);

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri(c),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResp.ok) {
    return c.text(`token exchange failed: ${await tokenResp.text()}`, 502);
  }
  const { id_token } = (await tokenResp.json()) as { id_token?: string };
  if (!id_token) return c.text("no id_token in response", 502);

  const payload = JSON.parse(atob(id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  const user: SessionUser = {
    email: payload.email ?? "",
    name: payload.name ?? payload.email ?? "",
    picture: payload.picture ?? "",
  };

  await setSignedCookie(c, SESSION_COOKIE, JSON.stringify(user), c.env.SESSION_SECRET, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return c.redirect("/dashboard");
});

app.get("/api/auth/google/session", async (c) => {
  const raw = await getSignedCookie(c, c.env.SESSION_SECRET, SESSION_COOKIE);
  if (!raw) return c.json({ user: null }, 401);
  return c.json({ user: JSON.parse(raw) as SessionUser });
});

app.post("/api/auth/google/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// --- Backend proxy: everything else under /api/* forwards to the AWS-hosted
// api service, same-origin from the browser's point of view. The GraphQL
// subscription's WebSocket upgrade can't be relayed through a plain fetch
// handler - gqlClient falls back to connecting that one directly to
// API_ORIGIN cross-origin; every REST/POST GraphQL call goes through here. ---
app.all("/api/*", async (c) => {
  const url = new URL(c.req.url);
  const target = `${c.env.API_ORIGIN}${url.pathname}${url.search}`;
  const resp = await fetch(target, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: ["GET", "HEAD"].includes(c.req.method) ? undefined : c.req.raw.body,
  });
  return new Response(resp.body, resp);
});

// SPA fallback for deep links (e.g. /dashboard/trades) that don't match a
// static asset - assets themselves are served by Cloudflare's asset layer
// before this worker ever runs.
app.get("*", (c) => c.text("not found", 404));

export default app;
