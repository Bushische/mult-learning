#!/usr/bin/env bash
# Build the production images for the Synology DS223j (linux/arm64).
#
# Usage:
#   scripts/build-images.sh              # build both images for linux/arm64
#   scripts/build-images.sh --local      # build for the host architecture (faster)
#   scripts/build-images.sh --push       # also push to a registry
set -euo pipefail
cd "$(dirname "$0")/.."

PLATFORM="linux/arm64"
PUSH=0
for arg in "$@"; do
  case "$arg" in
    --local) PLATFORM="linux/$(uname -m | sed 's/aarch64/arm64/; s/x86_64/amd64/')" ;;
    --push) PUSH=1 ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

API_IMAGE="mult-learning-api:latest"
WEB_IMAGE="mult-learning-web:latest"

echo "==> building $API_IMAGE for $PLATFORM"
docker buildx build --platform "$PLATFORM" -f apps/api/Dockerfile -t "$API_IMAGE" .

echo "==> building $WEB_IMAGE for $PLATFORM"
docker buildx build --platform "$PLATFORM" -f apps/web/Dockerfile -t "$WEB_IMAGE" .

if [ "$PUSH" = "1" ]; then
  echo "==> pushing images"
  docker push "$API_IMAGE"
  docker push "$WEB_IMAGE"
fi

echo "==> images:"
docker images | grep -E "mult-learning-(api|web)" || true
