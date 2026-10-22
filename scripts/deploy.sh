#!/usr/bin/env bash
# Deploy the app.
#
#   scripts/deploy.sh                 # local run: compose up (prod compose file)
#   scripts/deploy.sh --nas <host>    # save the images, copy them to the NAS and load them
#   scripts/deploy.sh --seed          # run the seed script inside the api container
#   scripts/deploy.sh --smoke         # run the smoke test against the running stack
#
# The script is idempotent: running it twice does not change anything.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.prod.yml"
NAS_HOST=""
DO_SEED=0
DO_SMOKE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --nas) NAS_HOST="$2"; shift 2 ;;
    --seed) DO_SEED=1; shift ;;
    --smoke) DO_SMOKE=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ -n "$NAS_HOST" ]; then
  echo "==> saving the images"
  docker save mult-learning-api:latest mult-learning-web:latest | gzip > mult-learning-images.tar.gz

  echo "==> copying to $NAS_HOST"
  scp mult-learning-images.tar.gz "$NAS_HOST":/tmp/mult-learning-images.tar.gz

  echo "==> loading the images on $NAS_HOST"
  ssh "$NAS_HOST" "docker load -i /tmp/mult-learning-images.tar.gz && rm -f /tmp/mult-learning-images.tar.gz"

  echo "==> starting the stack on $NAS_HOST"
  ssh "$NAS_HOST" "cd ~/mult-learning && docker compose -f $COMPOSE_FILE up -d"
  rm -f mult-learning-images.tar.gz
  exit 0
fi

if [ ! -f .env ]; then
  echo "==> .env is missing — copying .env.example (edit it before going live!)"
  cp .env.example .env
fi

echo "==> docker compose -f $COMPOSE_FILE up -d"
docker compose -f "$COMPOSE_FILE" up -d

if [ "$DO_SEED" = "1" ]; then
  echo "==> seeding the database"
  docker compose -f "$COMPOSE_FILE" exec api node dist/scripts/seed.js
fi

if [ "$DO_SMOKE" = "1" ]; then
  echo "==> smoke test"
  WEB_PORT="${WEB_PORT:-8080}" scripts/smoke.sh
fi

echo "==> done"
