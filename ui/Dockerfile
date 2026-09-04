# build - context must be the monorepo root: bun's frozen lockfile resolves
# every workspace member (ui, packages) and the build reads the root
# package.json/bun.lock
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock* ./
COPY . .
RUN bun install --frozen-lockfile
RUN bun --cwd ui build
# runtime (standalone SSR for AWS/dev)
FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=build /app/ui/.next/standalone ./
COPY --from=build /app/ui/.next/static ./ui/.next/static
EXPOSE 3000
# Docker sets HOSTNAME to the container ID by default; Next's standalone
# server.js binds to whatever HOSTNAME resolves to rather than the wildcard
# address, so without this it listens only on the container's own docker-
# network IP and neither 127.0.0.1 nor 0.0.0.0 healthchecks can reach it.
ENV HOSTNAME=0.0.0.0
CMD ["node", "ui/server.js"]
