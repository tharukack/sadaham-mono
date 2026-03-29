FROM postgres:16-bookworm AS pgtools

FROM node:20-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV BACKUP_RUNTIME_DIR=/app/.backup-runtime
ENV GOOGLE_DRIVE_CREDENTIALS_FILE=/app/credentials.json
ENV PG_DUMP_COMMAND=/usr/lib/postgresql/16/bin/pg_dump

RUN apt-get update && apt-get install -y ca-certificates libpq5 && rm -rf /var/lib/apt/lists/*

COPY --from=pgtools /usr/lib/postgresql/16 /usr/lib/postgresql/16

COPY infra/backup ./infra/backup

CMD ["node", "infra/backup/drive-backup-worker.js"]