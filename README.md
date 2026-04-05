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
# Update DATABASE_URL and Mobile Message credentials as needed
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

## PostgreSQL Backups (30 Minutes Change Check -> 7 Day Safety Backup -> Google Drive)

The backup flow now runs as a dedicated `backup` Docker service whenever the Docker stack is up. Docker Compose maps the runtime directory and credentials into container paths automatically.

Behavior:

- checks the database every 30 minutes,
- uploads a new backup immediately when the dump content changes,
- forces a backup every 7 days even if nothing changed,
- stores backups in the visible Google Drive folder `sadaham_backup_dev/YYYY-MM-DD/`,
- deletes only backups older than 6 months,
- writes backup events into `.backup-runtime` so the admin audit screen can show status history.

### Required Environment

```bash
BACKUP_DRIVE_ROOT_FOLDER=sadaham_backup_dev
BACKUP_RETENTION_MONTHS=6
BACKUP_UNCHANGED_INTERVAL_DAYS=7
BACKUP_CHECK_INTERVAL_MINUTES=30
BACKUP_RUNTIME_DIR=.backup-runtime
GOOGLE_DRIVE_CREDENTIALS_FILE=credentials.json
```

### Docker Requirements

- Keep `credentials.json` in the project root.
- Share the Google Drive folder `sadaham_backup_dev` with the service account email from `credentials.json` if you want uploads to land in a folder visible in your own Drive UI.
- Bring the stack up with Docker Compose so the `backup` service stays running.

### Manual Backup Run

```bash
pnpm run backup:drive
```

### Restore Manually

1. Download the latest `.sql.gz` file from Google Drive.
2. Restore it into PostgreSQL:

```bash
gzip -dc backup.sql.gz | psql "postgresql://user:password@localhost:5432/order_management"
```

## Production setup

docker compose --env-file .env.production up --build 

docker compose --env-file .env.production exec api npx prisma migrate deploy

docker compose --env-file .env.production exec api npx prisma db seed

docker compose --env-file .env.production exec api node prisma/import-customers.js

##Production setup

docker compose --env-file .env up --build 

docker compose --env-file .env exec api npx prisma migrate deploy

docker compose --env-file .env exec api npx prisma db seed

docker compose --env-file .env exec api node prisma/import-customers.js

## backup

docker compose --env-file .env.production rm -sf db docker volume ls
docker volume rm sadaham-mono_postgres_data
docker compose --env-file .env.production up -d db
docker cp .\backup.sql.gz sadaham-mono-db-1:/tmp/backup.sql.gz
docker compose --env-file .env.production exec db sh -lc 'gunzip -c /tmp/backup.sql.gz | psql -U $user -d $db_name'

## Migration
docker compose --env-file .env.production exec api npx prisma migrate status
docker compose --env-file .env.production exec api npx prisma migrate deploy


