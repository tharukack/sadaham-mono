# Order Management System

Monolithic full-stack starter for managing campaigns, orders, customers, and SMS notifications. The repository contains a NestJS + Prisma API (port 4000) and a Next.js frontend (port 3000).

## Getting Started

1. Install dependencies

```bash
pnpm install
```

2. Configure environment

```bash
cp .env.example .env
# Update DATABASE_URL and Twilio credentials as needed
# `TWILIO_BYPASS=true` keeps SMS offline and echoes OTP codes in responses for testing
```

3. Run Prisma migrations and seed data

```bash
pnpm run prisma:migrate
pnpm run seed
```

4. Start the dev servers (API + web)

```bash
pnpm run dev
```

Default seeded admin for quick testing:

- Mobile: `+61400000001`
- Password: `1234`

API docs and resources are organized by modules under `src/`, while the frontend lives in `web/` using Next.js and React Query.
