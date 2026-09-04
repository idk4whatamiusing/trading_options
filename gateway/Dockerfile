FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock* ./
COPY . .
RUN bun install --frozen-lockfile
RUN BUILD_TARGET=export bun --cwd ui build
FROM oven/bun:1-alpine AS runtime
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/ui/out ./ui/out
COPY gateway/wrangler.toml ./wrangler.toml
COPY gateway/src ./src
EXPOSE 8787
CMD ["node", "node_modules/.bin/wrangler", "dev", "--local", "--port", "8787"]
