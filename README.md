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

- Mobile: `0400000001`
- Password: `1234`

API docs and resources are organized by modules under `src/`, while the frontend lives in `web/` using Next.js and React Query.

## PostgreSQL Backups (Hourly -> Gzip -> Google Drive)

This project includes a production-safe backup script that uses `pg_dump`, compresses with `gzip`, uploads to Google Drive via `rclone`, and logs results. It is safe to run hourly from cron and avoids overwriting existing backup files.

### Prerequisites

- PostgreSQL client tools (`pg_dump`, `psql`)
- `rclone` configured with a Google Drive remote
- A cron-enabled environment (Linux/macOS)

### Install PostgreSQL Client Tools

Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y postgresql-client
```

macOS (Homebrew):

```bash
brew install libpq
brew link --force libpq
```

### Install and Configure rclone for Google Drive

1. Install rclone from https://rclone.org/downloads/
2. Run configuration and create a Google Drive remote:

```bash
rclone config
```

3. Use the remote name in `RCLONE_REMOTE` (see `.env.backup`).

### Configure Environment

1. Copy the example file and update values:

```bash
cp .env.backup .env.backup.local
```

2. Export variables before running the script:

```bash
set -a
. ./.env.backup.local
set +a
```

### Test the Backup Script Manually

```bash
chmod +x scripts/backup_postgres_to_gdrive.sh
scripts/backup_postgres_to_gdrive.sh
```

### Cron Example (Run Hourly)

```bash
0 * * * * /absolute/path/to/scripts/backup_postgres_to_gdrive.sh
```

### Restore Manually (Plain SQL Dump)

1. Download the latest `.sql.gz` backup from Google Drive to your server.
2. Create a fresh database:

```bash
createdb -h $PGHOST -p $PGPORT -U $PGUSER your_database_name
```

3. Restore the backup:

```bash
gunzip -c /path/to/backup.sql.gz | psql -h $PGHOST -p $PGPORT -U $PGUSER -d your_database_name
```

This will recreate schema and data from the plain SQL dump.





##Production setup

docker compose --env-file .env.production up --build 

docker compose --env-file .env.production exec api npx prisma migrate deploy
