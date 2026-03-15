#!/usr/bin/env bash
set -euo pipefail

umask 077

log() {
  local message="$1"
  local timestamp
  timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '%s %s\n' "$timestamp" "$message" >> "$BACKUP_LOG_FILE"
  printf '%s %s\n' "$timestamp" "$message"
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

require_env PGHOST
require_env PGPORT
require_env PGDATABASE
require_env PGUSER
require_env PGPASSWORD
require_env BACKUP_TMP_DIR
require_env BACKUP_LOG_FILE
require_env RCLONE_REMOTE
require_env RCLONE_BACKUP_DIR

BACKUP_TMP_RETENTION_HOURS="${BACKUP_TMP_RETENTION_HOURS:-48}"

mkdir -p "$BACKUP_TMP_DIR"
mkdir -p "$(dirname "$BACKUP_LOG_FILE")"

LOCK_DIR="${BACKUP_TMP_DIR%/}/.pg_backup_lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log "Another backup process appears to be running. Exiting."
  exit 1
fi
trap 'rm -rf "$LOCK_DIR"' EXIT
trap 'log "ERROR: Backup failed at line $LINENO"; exit 1' ERR

timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
base_name="pg_${PGDATABASE}_${timestamp}"
sql_file="${BACKUP_TMP_DIR%/}/${base_name}.sql"
gz_file="${sql_file}.gz"

if [[ -e "$sql_file" || -e "$gz_file" ]]; then
  log "Refusing to overwrite existing backup file: $sql_file"
  exit 1
fi

log "Starting PostgreSQL backup for database: $PGDATABASE"
pg_dump --format=plain --no-owner --no-privileges --file "$sql_file"

log "Compressing backup: $gz_file"
gzip -f "$sql_file"

remote_dir="${RCLONE_REMOTE}:${RCLONE_BACKUP_DIR}"
remote_file="${base_name}.sql.gz"

log "Uploading backup to Google Drive: ${remote_dir}/${remote_file}"
rclone copy --immutable "$gz_file" "$remote_dir"

log "Verifying upload in Google Drive"
if ! rclone lsf --max-depth 1 "$remote_dir" | grep -Fx "$remote_file" >/dev/null; then
  log "Upload verification failed for ${remote_dir}/${remote_file}"
  exit 1
fi

log "Upload verified. Removing local backup file."
rm -f "$gz_file"

retention_minutes=$((BACKUP_TMP_RETENTION_HOURS * 60))
find "$BACKUP_TMP_DIR" -type f -name 'pg_*.sql*' -mmin +"$retention_minutes" -delete || true

log "Backup completed successfully."
