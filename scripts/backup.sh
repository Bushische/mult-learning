#!/usr/bin/env bash
# Daily SQLite backup (crash consistent, WAL safe) — run it from the NAS scheduler.
#
#   scripts/backup.sh [target-dir]
#
# The snapshot is created with `sqlite3 <db> ".backup <file>"` (no file copy —
# that would be unsafe with WAL).
set -euo pipefail

DB_PATH="${DATABASE_PATH:-/data/app.db}"
TARGET_DIR="${1:-/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F)"
TARGET="$TARGET_DIR/app-$STAMP.db"

if [ ! -f "$DB_PATH" ]; then
  echo "BACKUP: $DB_PATH does not exist — nothing to do" >&2
  exit 0
fi

mkdir -p "$TARGET_DIR"
echo "==> backing up $DB_PATH -> $TARGET"
sqlite3 "$DB_PATH" ".backup '$TARGET'"
gzip -f "$TARGET"
echo "==> snapshot: $TARGET.gz"

# retention: keep the last 14 daily snapshots
find "$TARGET_DIR" -name 'app-*.db.gz' -mtime "+$KEEP_DAYS" -print -delete
echo "BACKUP: ok"
