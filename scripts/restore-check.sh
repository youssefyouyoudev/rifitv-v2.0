#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_SQL="${1:?Usage: restore-check.sh /path/to/database.sql.gz}"
RESTORE_CHECK_DATABASE="${RESTORE_CHECK_DATABASE:?RESTORE_CHECK_DATABASE is required}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:?DB_USERNAME is required}"

echo "Restoring $BACKUP_SQL into isolated database $RESTORE_CHECK_DATABASE"
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" -e "CREATE DATABASE IF NOT EXISTS \`$RESTORE_CHECK_DATABASE\`;"
gzip -dc "$BACKUP_SQL" | mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" "$RESTORE_CHECK_DATABASE"
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" -e "SELECT COUNT(*) AS tables_checked FROM information_schema.tables WHERE table_schema = '$RESTORE_CHECK_DATABASE';"
echo "Restore check completed. Drop $RESTORE_CHECK_DATABASE manually after inspection."
