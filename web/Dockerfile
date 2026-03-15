FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web ./web

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter order-management-web build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/web/public ./web/public
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "web/server.js"]
