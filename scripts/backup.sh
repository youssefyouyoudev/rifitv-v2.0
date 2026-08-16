#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/rifitv}"
APP_DIR="${APP_DIR:-/var/www/rifitv-v2.0}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="${DB_DATABASE:?DB_DATABASE is required}"
DB_USERNAME="${DB_USERNAME:?DB_USERNAME is required}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/$STAMP"

mkdir -p "$DEST"

mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USERNAME" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_DATABASE" | gzip > "$DEST/database.sql.gz"

tar -C "$APP_DIR/backend/storage/app" -czf "$DEST/public-storage.tar.gz" public
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

echo "Backup written to $DEST"
