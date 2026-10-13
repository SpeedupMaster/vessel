#!/bin/sh
# All Docker/network/system commands are stubs; no root or daemon needed.
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' 0
mkdir "$WORK/bin"
export TEST_LOG="$WORK/commands.log" TEST_ROOT="$WORK"
export VESSEL_INSTALL_DIR="$WORK/vessel" VESSEL_IMAGE=example.invalid/vessel:v1.0.0 VESSEL_PORT=4390
export PATH="$WORK/bin:$PATH"
cat > "$WORK/bin/uname" <<'EOF'
#!/bin/sh
case "$1" in -s) echo Linux ;; -m) echo x86_64 ;; esac
EOF
cat > "$WORK/bin/id" <<'EOF'
#!/bin/sh
echo 0
EOF
cat > "$WORK/bin/curl" <<'EOF'
#!/bin/sh
echo 'Unexpected network access in installer test' >&2
exit 99
EOF
cat > "$WORK/bin/sleep" <<'EOF'
#!/bin/sh
exit 0
EOF
cat > "$WORK/bin/docker" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "$TEST_LOG"
case "$1" in
  info) exit 0 ;;
  container) [ "${TEST_EXISTING:-0}" = 1 ]; exit $? ;;
  inspect)
    case "$3" in
      *Mounts*) printf '%s/data\n' "$VESSEL_INSTALL_DIR" ;;
      *Config.Env*) [ "${TEST_LEGACY:-0}" = 0 ] && echo 'DATA_DIR=/app/data' || echo 'NODE_ENV=production' ;;
      *Labels*) echo vessel ;;
    esac ;;
  network) exit 0 ;;
  exec) [ "${TEST_TIMEOUT:-0}" = 0 ]; exit $? ;;
  compose)
    for arg in "$@"; do
      case "$arg" in
        pull) [ "${TEST_PULL_FAIL:-0}" = 0 ]; exit $? ;;
        up) [ "${TEST_UP_FAIL:-0}" = 0 ]; exit $? ;;
      esac
    done ;;
  *) exit 98 ;;
esac
EOF
chmod +x "$WORK/bin/"*
sh -n "$ROOT/scripts/install.sh"
sh "$ROOT/scripts/install.sh" > "$WORK/result"
grep -q 'Vessel is ready' "$WORK/result"
grep -q "'4390:3900'" "$VESSEL_INSTALL_DIR/docker-compose.yml"
grep -q -- '--project-directory' "$TEST_LOG"
test ! -d "$VESSEL_INSTALL_DIR/.install-lock"
printf 'valuable data' > "$VESSEL_INSTALL_DIR/data/keep.txt"
export TEST_EXISTING=1
unset VESSEL_IMAGE VESSEL_PORT
# Pipe execution and persisted options both work without consuming stdin.
cat "$ROOT/scripts/install.sh" | sh > "$WORK/result"
grep -q "'4390:3900'" "$VESSEL_INSTALL_DIR/docker-compose.yml"
test "$(cat "$VESSEL_INSTALL_DIR/data/keep.txt")" = 'valuable data'
cp "$VESSEL_INSTALL_DIR/docker-compose.yml" "$WORK/before.yml"
export VESSEL_IMAGE=example.invalid/vessel:v2.0.0 TEST_PULL_FAIL=1
if sh "$ROOT/scripts/install.sh" > "$WORK/result" 2>&1; then echo 'Pull failure was ignored'; exit 1; fi
cmp "$WORK/before.yml" "$VESSEL_INSTALL_DIR/docker-compose.yml"
grep -q 'Image pull failed' "$WORK/result"
unset TEST_PULL_FAIL
export TEST_LEGACY=1
if sh "$ROOT/scripts/install.sh" > "$WORK/result" 2>&1; then echo 'Legacy install was replaced'; exit 1; fi
grep -q 'Legacy container detected' "$WORK/result"
unset TEST_LEGACY
export TEST_UP_FAIL=1
if sh "$ROOT/scripts/install.sh" > "$WORK/result" 2>&1; then echo 'Startup failure was ignored'; exit 1; fi
grep -q 'Startup failed' "$WORK/result"
unset TEST_UP_FAIL
export TEST_TIMEOUT=1
if sh "$ROOT/scripts/install.sh" > "$WORK/result" 2>&1; then echo 'Readiness failure was ignored'; exit 1; fi
grep -q 'Readiness check timed out' "$WORK/result"
unset TEST_TIMEOUT
export VESSEL_PORT=80
if sh "$ROOT/scripts/install.sh" > "$WORK/result" 2>&1; then echo 'Conflicting dashboard port accepted'; exit 1; fi
unset VESSEL_PORT
printf 'user configuration\n' > "$VESSEL_INSTALL_DIR/docker-compose.yml"
if sh "$ROOT/scripts/install.sh" > "$WORK/result" 2>&1; then echo 'Unmanaged config overwritten'; exit 1; fi
test "$(cat "$VESSEL_INSTALL_DIR/docker-compose.yml")" = 'user configuration'
test "$(cat "$VESSEL_INSTALL_DIR/data/keep.txt")" = 'valuable data'
test ! -d "$VESSEL_INSTALL_DIR/.install-lock"
echo 'Installer tests passed: fresh install, pipe execution, reinstall, persisted settings, pull failure, legacy guard, startup failure, readiness timeout, port validation, unmanaged configuration.'
