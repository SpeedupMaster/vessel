#!/bin/sh
# Test the production functions with mocked OS probes, package managers and services.
# Never invoke real package installation, network access or service management.
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' 0
sed -e '$d' \
    -e 's/apt-get/mock_apt_get/g' \
    -e 's/apt-cache/mock_apt_cache/g' \
    -e 's/rc-service/mock_rc_service/g' \
    -e 's/rc-update/mock_rc_update/g' \
    "$ROOT/scripts/install.sh" > "$WORK/functions.sh"
. "$WORK/functions.sh"

reset_case() {
  PACKAGE_MANAGER='' PACKAGES_UPDATED=0
  TEST_DISTRO=ubuntu TEST_LIKE='' TEST_CURL=1 TEST_CA=1 TEST_COMPOSE=2.29.0
  TEST_DAEMON=1 TEST_MANAGER=systemctl TEST_DNF=1 TEST_ACCEPT=docker-compose-plugin
  TEST_PACKAGE_FAIL=0 TEST_START_FAIL=0 TEST_NEVER_READY=0 TEST_NO_EFFECT=0
  TEST_CANDIDATE=2.26.1-4 TEST_POLLS=0 TEST_READY_AFTER=0
  : > "$WORK/log"
}
read_os_release() { ID=$TEST_DISTRO ID_LIKE=$TEST_LIKE; }
has_ca_certificates() { [ "$TEST_CA" = 1 ]; }
command() {
  if [ "${1:-}" = -v ]; then
    case "$2" in
      curl) [ "$TEST_CURL" = 1 ]; return $? ;;
      dnf) [ "$TEST_DNF" = 1 ]; return $? ;;
      apt-get|mock_apt_get|yum|apk|zypper) return 0 ;;
      systemctl|service) [ "$2" = "$TEST_MANAGER" ]; return $? ;;
      rc-service|mock_rc_service) [ "$TEST_MANAGER" = rc-service ]; return $? ;;
      rc-update|mock_rc_update) [ "$TEST_MANAGER" = rc-service ]; return $? ;;
    esac
  fi
  command "$@"
}
mock_packages() {
  printf '%s\n' "$*" >> "$WORK/log"
  # A package manager must never consume the caller's piped script/input.
  if read -r unexpected; then echo 'Package manager inherited stdin' >&2; return 99; fi
  [ "$TEST_PACKAGE_FAIL" = 0 ] || return 1
  case "$*" in *update*) return 0 ;; esac
  for package in "$@"; do
    case "$package" in
      curl) [ "$TEST_NO_EFFECT" = 1 ] || TEST_CURL=1 ;;
      ca-certificates) [ "$TEST_NO_EFFECT" = 1 ] || TEST_CA=1 ;;
      docker-compose*|docker-cli-compose)
        [ "$package" = "$TEST_ACCEPT" ] || return 1
        [ "$TEST_NO_EFFECT" = 1 ] || TEST_COMPOSE=2.29.0 ;;
    esac
  done
  return 0
}
mock_apt_get() { mock_packages apt-get "$@"; }
dnf() { mock_packages dnf "$@"; }
yum() { mock_packages yum "$@"; }
apk() { mock_packages apk "$@"; }
zypper() { mock_packages zypper "$@"; }
mock_apt_cache() { printf '  Candidate: %s\n' "$TEST_CANDIDATE"; }
docker() {
  case "$*" in
    info)
      TEST_POLLS=$((TEST_POLLS + 1))
      [ "$TEST_DAEMON" = 1 ] && [ "$TEST_NEVER_READY" = 0 ] && [ "$TEST_POLLS" -gt "$TEST_READY_AFTER" ] ;;
    'compose version --short') [ -n "$TEST_COMPOSE" ] && printf '%s\n' "$TEST_COMPOSE" ;;
    *) echo 'Unexpected Docker command in dependency test' >&2; return 99 ;;
  esac
}
mock_start() {
  printf '%s\n' "$*" >> "$WORK/log"
  if read -r unexpected; then echo 'Service manager inherited stdin' >&2; return 99; fi
  [ "$TEST_START_FAIL" = 0 ] || return 1
  TEST_DAEMON=1
}
systemctl() {
  case "$1" in
    show-environment) return 0 ;;
    start) mock_start systemctl "$@" ;;
    enable) printf '%s\n' "systemctl $*" >> "$WORK/log" ;;
    *) return 99 ;;
  esac
}
mock_rc_service() { mock_start rc-service "$@"; }
mock_rc_update() { printf '%s\n' "rc-update $*" >> "$WORK/log"; }
service() { mock_start service "$@"; }
sleep() { :; }
expect_failure() {
  EXPECTED=$1
  shift
  if ( "$@" ) > "$WORK/error" 2>&1; then
    echo "Expected failure: $*" >&2; exit 1
  fi
  grep -q "$EXPECTED" "$WORK/error" || { cat "$WORK/error"; exit 1; }
}

reset_case
ensure_base_dependencies
ensure_compose
ensure_docker_running
test ! -s "$WORK/log"
TEST_COMPOSE=v5.0.0
ensure_compose
test ! -s "$WORK/log"

for distribution in ubuntu debian rocky fedora amzn alpine opensuse-leap; do
  reset_case
  TEST_DISTRO=$distribution TEST_CURL=0 TEST_CA=0 TEST_COMPOSE=''
  case "$distribution" in
    alpine) TEST_ACCEPT=docker-cli-compose ;;
    opensuse-leap) TEST_ACCEPT=docker-compose ;;
  esac
  printf 'caller input\n' > "$WORK/stdin"
  ensure_base_dependencies < "$WORK/stdin"
  ensure_compose
  test "$TEST_CURL" = 1 && test "$TEST_CA" = 1
  has_compose
  case "$distribution" in
    ubuntu|debian) grep -q '^apt-get install -y --no-install-recommends curl ca-certificates$' "$WORK/log"
      test "$(grep -c '^apt-get update$' "$WORK/log")" = 1 ;;
    rocky|fedora|amzn) grep -q '^dnf install -y curl ca-certificates$' "$WORK/log" ;;
    alpine) grep -q '^apk add --no-cache curl ca-certificates$' "$WORK/log" ;;
    opensuse-leap) grep -q '^zypper --non-interactive install --no-recommends curl ca-certificates$' "$WORK/log" ;;
  esac
done
reset_case
TEST_DISTRO=custom TEST_LIKE='rhel fedora' TEST_DNF=0 TEST_CA=0
ensure_base_dependencies
grep -q '^yum install -y ca-certificates$' "$WORK/log"

for package in docker-compose-v2 docker-compose; do
  reset_case
  TEST_COMPOSE=1.29.2 TEST_ACCEPT=$package
  ensure_compose
  has_compose
done
reset_case
TEST_COMPOSE='' TEST_ACCEPT=docker-compose TEST_CANDIDATE=1.29.2-1
expect_failure 'Could not install a working' ensure_compose
if grep -q 'install .* docker-compose$' "$WORK/log"; then echo 'Installed legacy Compose v1'; exit 1; fi
reset_case
TEST_COMPOSE='' TEST_NO_EFFECT=1
expect_failure 'Could not install a working' ensure_compose
reset_case
TEST_CURL=0 TEST_PACKAGE_FAIL=1
expect_failure 'Failed to install base dependencies' ensure_base_dependencies
reset_case
TEST_CA=0 TEST_NO_EFFECT=1
expect_failure 'CA certificate bundle is still unavailable' ensure_base_dependencies
reset_case
TEST_DISTRO=unsupported TEST_CA=0
expect_failure 'Cannot install dependencies automatically' ensure_base_dependencies

for manager in systemctl rc-service service; do
  reset_case
  TEST_DAEMON=0 TEST_MANAGER=$manager
  printf 'caller input\n' > "$WORK/stdin"
  ensure_docker_running < "$WORK/stdin"
  test "$TEST_DAEMON" = 1
  case "$manager" in
    systemctl) grep -q '^systemctl start docker$' "$WORK/log"
      grep -q '^systemctl enable docker$' "$WORK/log" ;;
    rc-service) grep -q '^rc-service docker start$' "$WORK/log"
      grep -q '^rc-update add docker default$' "$WORK/log" ;;
    service) grep -q '^service docker start$' "$WORK/log" ;;
  esac
done
reset_case
TEST_DAEMON=0 TEST_READY_AFTER=3
ensure_docker_running
test "$TEST_POLLS" = 4
reset_case
TEST_DAEMON=0 TEST_START_FAIL=1
expect_failure 'Failed to start Docker' ensure_docker_running
reset_case
TEST_DAEMON=0 TEST_NEVER_READY=1
expect_failure 'Docker did not become ready within 60 seconds' ensure_docker_running
reset_case
TEST_DAEMON=0 TEST_MANAGER=none
expect_failure 'No supported service manager' ensure_docker_running
echo 'Dependency tests passed: distro packages, missing curl/CA, Compose fallback/version verification, package failures, idempotence, service startup, readiness timeout and stdin isolation.'
