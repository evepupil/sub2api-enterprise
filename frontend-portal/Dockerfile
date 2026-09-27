# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps

WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@10.34.5 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN mkdir -p public
RUN pnpm build
RUN node scripts/prepare-standalone.mjs

FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV HOSTNAME=0.0.0.0 \
  PORT=3000 \
  NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next-build/standalone ./

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('node:http'); const request = http.get('http://127.0.0.1:3000/api/health', (response) => { response.resume(); process.exit(response.statusCode === 200 ? 0 : 1); }); request.on('error', () => process.exit(1)); request.setTimeout(4000, () => { request.destroy(); process.exit(1); });"

CMD ["node", "server.js"]
