#!/usr/bin/env bash
set -euo pipefail
VOLUME="vessel-ci-${RANDOM}"
NAME="vessel-ci-${RANDOM}"
PASSWORD="ci-initial-password-${RANDOM}-${RANDOM}"
cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker volume create "$VOLUME" >/dev/null
start() {
  docker run -d --name "$NAME" -p 127.0.0.1::3900 -v "$VOLUME:/app/data" -e VESSEL_ADMIN_PASSWORD="$PASSWORD" vessel:ci >/dev/null
  PORT=$(docker port "$NAME" 3900/tcp | cut -d: -f2)
  for attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/api/auth/status" >/dev/null; then return; fi
    sleep 1
  done
  docker logs "$NAME"
  exit 1
}
start
test "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/apps")" = 401
TOKEN=$(curl -fsS "http://127.0.0.1:$PORT/api/auth/login" -H 'Content-Type: application/json' \
  --data "{\"username\":\"admin\",\"password\":\"$PASSWORD\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
docker rm -f "$NAME" >/dev/null
start
curl -fsS "http://127.0.0.1:$PORT/api/apps" -H "Authorization: Bearer $TOKEN" | python3 -c 'import json,sys; assert json.load(sys.stdin) == [], "Fresh installation contains demo applications"'
docker exec "$NAME" test -f /app/data/vessel_db.json
