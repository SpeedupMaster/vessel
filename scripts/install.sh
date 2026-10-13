#!/bin/sh
# Release automation fills DEFAULT_IMAGE with the published image digest.
set -eu
DEFAULT_IMAGE=''
fail() { printf '\n[Vessel] ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '[Vessel] %s\n' "$*"; }

main() {
  case "${1:-}" in
    --help|-h)
      printf '%s\n' 'Usage: sh install.sh' \
        'Environment: VESSEL_IMAGE, VESSEL_INSTALL_DIR (/opt/vessel), VESSEL_PORT (3900)' \
        'VESSEL_INSTALL_DOCKER=0 disables automatic Docker installation.'
      return ;;
    '') ;;
    *) fail "Unknown argument: $1" ;;
  esac
  [ "$(uname -s)" = Linux ] || fail 'This installer supports Linux servers only.'
  [ "$(id -u)" = 0 ] || fail 'Run as root, or pipe the installer to sudo sh.'
  case "$(uname -m)" in x86_64|aarch64|arm64) ;; *) fail 'Supported architectures: amd64 and arm64.' ;; esac
  command -v curl >/dev/null 2>&1 || fail 'Install curl first using your distribution package manager.'
  umask 077
  INSTALL_DIR=${VESSEL_INSTALL_DIR:-/opt/vessel}
  case "$INSTALL_DIR" in /*) ;; *) fail 'VESSEL_INSTALL_DIR must be an absolute path.' ;; esac
  case "$INSTALL_DIR" in *[!a-zA-Z0-9_./-]*|*/../*|*/..|/) fail 'Use an absolute install path without spaces or parent traversal.' ;; esac
  mkdir -p "$INSTALL_DIR"
  INSTALL_DIR=$(cd "$INSTALL_DIR" && pwd -P)
  IMAGE=${VESSEL_IMAGE:-$DEFAULT_IMAGE}
  if [ -z "$IMAGE" ] && [ -f "$INSTALL_DIR/.vessel-image" ]; then IMAGE=$(cat "$INSTALL_DIR/.vessel-image"); fi
  [ -n "$IMAGE" ] || fail 'Use a published release installer, or set VESSEL_IMAGE to a published Vessel image.'
  case "$IMAGE" in -*|*[!a-zA-Z0-9_./:@-]*) fail 'Invalid VESSEL_IMAGE reference.' ;; esac
  PORT=${VESSEL_PORT:-}
  if [ -z "$PORT" ] && [ -f "$INSTALL_DIR/.vessel-port" ]; then PORT=$(cat "$INSTALL_DIR/.vessel-port"); fi
  PORT=${PORT:-3900}
  case "$PORT" in ''|*[!0-9]*|0*) fail 'VESSEL_PORT must be a decimal port from 1 to 65535.' ;; esac
  [ "${#PORT}" -le 5 ] && [ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || fail 'Invalid VESSEL_PORT.'
  [ "$PORT" != 80 ] && [ "$PORT" != 443 ] || fail 'Ports 80 and 443 are reserved for the reverse proxy.'
  LOCK="$INSTALL_DIR/.install-lock"
  mkdir "$LOCK" 2>/dev/null || fail "Installation lock exists: $LOCK. Inspect before removing a stale lock."
  STAGE=''
  trap 'cleanup' 0
  trap 'exit 130' INT
  trap 'exit 143' TERM
  STAGE=$(mktemp -d "$INSTALL_DIR/.install.XXXXXX")
  COMPOSE="$INSTALL_DIR/docker-compose.yml"
  if [ -f "$COMPOSE" ] && ! grep -q '^# Managed by Vessel installer$' "$COMPOSE"; then
    fail "Existing $COMPOSE is not managed by this installer. Back it up and migrate manually; it was not overwritten."
  fi
  if ! command -v docker >/dev/null 2>&1; then
    [ "${VESSEL_INSTALL_DOCKER:-1}" != 0 ] || fail 'Docker is required; automatic installation was disabled.'
    log 'Installing Docker Engine using the official installer...'
    curl -fSL --connect-timeout 15 --max-time 120 https://get.docker.com -o "$STAGE/docker-install.sh"
    sh "$STAGE/docker-install.sh" </dev/null
  fi
  docker info >/dev/null 2>&1 || fail 'Docker daemon is unavailable. Start Docker and retry.'
  docker compose version >/dev/null 2>&1 || fail 'Install the Docker Compose v2 plugin and retry.'
  if docker container inspect vessel-hub >/dev/null 2>&1; then
    [ -f "$COMPOSE" ] || fail 'An existing vessel-hub container belongs to another installation; migrate it first.'
    DATA_SOURCE=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Source}}{{end}}{{end}}' vessel-hub)
    [ "$DATA_SOURCE" = "$INSTALL_DIR/data" ] || fail 'Existing container uses a different data directory; migrate first.'
    docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' vessel-hub | grep -qx 'DATA_DIR=/app/data' ||
      fail 'Legacy container detected. Export /app/server/data before replacing it; see the upgrade guide.'
    PROJECT=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' vessel-hub)
    [ "$PROJECT" = vessel ] || fail 'Existing container belongs to another Compose project; migrate first.'
  fi
  mkdir -p "$INSTALL_DIR/data"
  CANDIDATE="$STAGE/docker-compose.yml"
  cat > "$CANDIDATE" <<EOF
# Managed by Vessel installer
services:
  vessel:
    image: '$IMAGE'
    container_name: vessel-hub
    restart: unless-stopped
    ports:
      - '$PORT:3900'
      - '80:80'
      - '443:443'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data
    networks:
      - vessel-net
    extra_hosts:
      - host.docker.internal:host-gateway
    environment:
      NODE_ENV: production
      PORT: '3900'
      DATA_DIR: /app/data
networks:
  vessel-net:
    external: true
EOF
  compose config --quiet
  log "Pulling $IMAGE ..."
  compose pull </dev/null || fail 'Image pull failed. Existing containers and Compose configuration were not replaced.'
  if ! docker network inspect vessel-net >/dev/null 2>&1; then docker network create vessel-net >/dev/null; fi
  if [ -f "$COMPOSE" ]; then cp -p "$COMPOSE" "$INSTALL_DIR/docker-compose.previous.yml"; fi
  # Keep the attempted configuration on failure, making logs and retries usable.
  cp "$CANDIDATE" "$COMPOSE"
  log 'Starting Vessel (TCP ports 80, 443, and the dashboard port must be available)...'
  compose up -d </dev/null || fail "Startup failed. Inspect: docker compose -p vessel -f $COMPOSE logs --tail 100"
  ATTEMPT=0
  while [ "$ATTEMPT" -lt 60 ]; do
    if docker exec vessel-hub node -e 'fetch("http://127.0.0.1:3900/api/auth/status", {signal: AbortSignal.timeout(2000)}).then(async r => { const b = await r.json(); if (!r.ok || b.initialized !== true) process.exit(1); }).catch(() => process.exit(1))' >/dev/null 2>&1; then
      printf '%s\n' "$IMAGE" > "$INSTALL_DIR/.vessel-image"
      printf '%s\n' "$PORT" > "$INSTALL_DIR/.vessel-port"
      log 'Vessel is ready.'
      printf '\nDashboard: http://<SERVER-IP>:%s\nUsername: admin\nData directory: %s/data\n' "$PORT" "$INSTALL_DIR"
      if [ -f "$INSTALL_DIR/data/initial-admin-password" ]; then
        printf 'Read the initial password: sudo cat %s/data/initial-admin-password\nChange it after signing in.\n' "$INSTALL_DIR"
      else
        printf 'Existing administrator credentials are unchanged.\n'
      fi
      return
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 2
  done
  fail "Readiness check timed out. Data was retained. Inspect: docker compose -p vessel -f $COMPOSE logs --tail 100"
}
compose() { docker compose --project-name vessel --project-directory "$INSTALL_DIR" -f "$CANDIDATE" "$@"; }
cleanup() { if [ -n "$STAGE" ]; then rm -rf "$STAGE"; fi; rmdir "$LOCK" 2>/dev/null || :; }
# Invocation at EOF allows sh to parse the complete main function before executing.
main "$@"
