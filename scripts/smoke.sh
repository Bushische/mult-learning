#!/usr/bin/env bash
# Smoke test for a running stack (dev or prod).
#
#   WEB_PORT=8080 scripts/smoke.sh
#
# Checks: /health, admin login, one answer, the heatmap of the demo child.
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:${WEB_PORT:-8080}}"
API_URL="$BASE_URL/api"

fail() { echo "SMOKE: FAILED — $1" >&2; exit 1; }

echo "==> 1/5 health"
health="$(curl -fsS "$API_URL/health")" || fail "GET /api/health failed"
echo "$health" | grep -q '"status":"ok"' || fail "unexpected health payload: $health"

echo "==> 2/5 login (admin / 1289)"
login="$(curl -fsS -c /tmp/mult-smoke-cookies.txt -H 'Content-Type: application/json' \
  -d '{"username":"admin","pin":"1289"}' "$API_URL/auth/login")" || fail "admin login failed"
token="$(echo "$login" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
[ -n "$token" ] || fail "no access token in the login response"

echo "==> 3/5 games for the demo child"
child_login="$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"username":"child1","pin":"2468"}' "$API_URL/auth/login")" || fail "child login failed"
child_token="$(echo "$child_login" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
[ -n "$child_token" ] || fail "no access token for child1"
games="$(curl -fsS -H "Authorization: Bearer $child_token" "$API_URL/games")" || fail "GET /games failed"
game_id="$(echo "$games" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$game_id" ] || fail "child1 has no assigned game"

echo "==> 4/5 answer (2 x 3 = 6)"
answer="$(curl -fsS -H "Authorization: Bearer $child_token" -H 'Content-Type: application/json' \
  -d "{\"gameId\":\"$game_id\",\"factorA\":2,\"factorB\":3,\"chosen\":6}" "$API_URL/answers")" \
  || fail "POST /answers failed"
echo "$answer" | grep -q '"correct":true' || fail "the answer was not accepted: $answer"

echo "==> 5/5 heatmap + daily stats"
heatmap="$(curl -fsS -H "Authorization: Bearer $child_token" "$API_URL/stats/heatmap")" \
  || fail "GET /stats/heatmap failed"
echo "$heatmap" | grep -q '"cells"' || fail "unexpected heatmap payload: $heatmap"
daily="$(curl -fsS -H "Authorization: Bearer $child_token" "$API_URL/stats/daily")" \
  || fail "GET /stats/daily failed"
echo "$daily" | grep -q '"totalTries"' || fail "unexpected daily payload: $daily"

rm -f /tmp/mult-smoke-cookies.txt
echo "SMOKE: ok — health, login, answer and stats all work"
