# Deploy - both flavors

This project deploys the same repo to **Cloudflare and AWS**. AWS hosts the
real backend (Postgres, `db`, `api`, `realtime`, `ai`); Cloudflare hosts only
the static UI export. No auth anywhere (single-user hackathon demo) - the UI
talks directly, cross-origin, to the AWS API origin.

CI/CD: `.github/workflows/cd.yml` deploys both on push to main -
`deploy-cloudflare` (secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
and `deploy-aws` (secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`). Deploy AWS
first; Cloudflare's build needs the AWS API's URL.

---

# AWS (EC2 + Docker + Caddy + sslip.io)

Everything runs as containers on one EC2 inside your VPC. Caddy terminates TLS
automatically via Let's Encrypt for `*.YOUR-IP.sslip.io` - zero cert management.

## 1. EC2

    cd infra && terraform init && terraform apply

Provisions EC2 (t3.small/medium), a security group (22/80/443), an Elastic
IP, Docker preinstalled via `user_data`. Note the output `public_ip`.

## 2. On the box

    git clone <your-repo> && cd <your-repo>

## 3. Configure + launch

    cp .env.example .env
    # set DOMAIN=<public_ip>.sslip.io, POSTGRES_PASSWORD, BACKEND_SECRET
    # set ALPACA_API_KEY, ALPACA_SECRET_KEY, ALPACA_PAPER_TRADE=true
    # set CF_ACCOUNT_ID, CF_API_TOKEN (Workers AI - the trading brain's LLM calls, not this Cloudflare deploy)
    docker compose -f compose.prod.yaml up -d --build

## 4. Verify

    curl https://YOUR-PUBLIC-IP.sslip.io          # web (unused once Cloudflare UI is live; still serves standalone SSR)
    curl https://api.YOUR-PUBLIC-IP.sslip.io/health

Caddy auto-redirects http -> https and renews certs itself.

## Scaling notes

- This runs one instance of every service (docker compose). Horizontal scale
  = multiple boxes + a load balancer; that's when realtime needs the Redis
  pub/sub broker instead of its in-memory fanout (see realtime/src/broker.gleam).
- VPC subnets/peering, RDS instead of container Postgres, ECR: account-level
  choices, add them when the workloads justify it.

---

# Cloudflare (static UI export only)

Prereqs: `bun`, a Cloudflare account, and the AWS API's public URL from above.

## 1. Build the web static export

    NEXT_PUBLIC_API_URL=https://api.YOUR-PUBLIC-IP.sslip.io BUILD_TARGET=export npm run build --workspace ui
    # outputs ui/out, baked with the AWS API origin

## 2. Run locally

    cd gateway
    npx wrangler dev

## 3. Deploy

    npx wrangler deploy

## Notes

- The worker has no `/api/*` proxy and no auth - Workers can't relay an
  outbound WebSocket upgrade through a plain fetch handler (what the
  GraphQL subscription needs), and there's no session to protect anyway.
  The UI calls `NEXT_PUBLIC_API_URL` directly, cross-origin; the AWS `api`
  service's CORS + websocket accept options already allow this (see
  `api/cmd/api/main.go`).
- Alpaca/Workers-AI credentials never enter this deploy - they live only in
  the AWS `ai` container's environment (see Phase 8d in the plan / the
  write-up's secrets-boundary note).
