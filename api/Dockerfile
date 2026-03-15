FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/package.json
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./tsconfig.json

RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate
RUN pnpm build
RUN pnpm prune --prod

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

USER nestjs
EXPOSE 4000

CMD ["node", "dist/main.js"]
