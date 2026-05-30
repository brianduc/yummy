FROM node:lts-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM node:lts-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm@9
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 hono

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=hono:nodejs . .

USER hono
EXPOSE 8000
ENV PORT=8000
ENV NODE_ENV=production

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
