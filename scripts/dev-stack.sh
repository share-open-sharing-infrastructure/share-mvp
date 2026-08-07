#!/usr/bin/env bash
#
# Bring up the full local AllerLeih stack with one command: the real-schema PocketBase
# backend, the SvelteKit dev server, and (optionally) seed data — with all the env
# gotchas baked in (trailing-slash PUBLIC_PB_URL, DEV_DISABLE_MKCERT, 127.0.0.1 binding).
#
# The PocketBase backend lives in a SEPARATE repo (share-open-sharing-infrastructure/
# allerleih-backend). Point this script at your checkout via PB_BACKEND_DIR (default: a
# sibling `../allerleih-backend` with the `pocketbase` binary copied in).
#
# Usage:
#   scripts/dev-stack.sh                 # start PB + dev server
#   scripts/dev-stack.sh --seed e2e      # also seed the `e2e` scenario first
#   scripts/dev-stack.sh --no-web        # only PB (e.g. to run `npm run test:e2e` yourself)
#
# Env overrides: PB_BACKEND_DIR, PB_BIN, PB_PORT (8091), WEB_PORT (5173),
#                PB_SUPERUSER_EMAIL (admin@local.test), PB_SUPERUSER_PASSWORD (localdev12345)
#
# PB runs in the background; the dev server runs in the foreground. Ctrl-C stops both.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PB_BACKEND_DIR="${PB_BACKEND_DIR:-$(cd "$REPO_ROOT/.." && pwd)/allerleih-backend}"
PB_BIN="${PB_BIN:-$PB_BACKEND_DIR/pocketbase}"
PB_PORT="${PB_PORT:-8091}"
WEB_PORT="${WEB_PORT:-5173}"
PB_SUPERUSER_EMAIL="${PB_SUPERUSER_EMAIL:-admin@local.test}"
PB_SUPERUSER_PASSWORD="${PB_SUPERUSER_PASSWORD:-localdev12345}"

SEED_SCENARIO=""
START_WEB=1
while [[ $# -gt 0 ]]; do
	case "$1" in
		--seed) SEED_SCENARIO="${2:?--seed needs a scenario name}"; shift 2 ;;
		--no-web) START_WEB=0; shift ;;
		-h|--help) grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) echo "Unknown argument: $1" >&2; exit 2 ;;
	esac
done

if [[ ! -x "$PB_BIN" ]]; then
	echo "PocketBase binary not found/executable at: $PB_BIN" >&2
	echo "Clone share-open-sharing-infrastructure/allerleih-backend and copy the pocketbase" >&2
	echo "binary in, or set PB_BACKEND_DIR / PB_BIN. See docs/testing-strategy.md." >&2
	exit 1
fi

PB_URL="http://127.0.0.1:${PB_PORT}"
PB_PID=""
cleanup() { [[ -n "$PB_PID" ]] && kill "$PB_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▶ Starting PocketBase (real schema) on $PB_URL …"
# Absolute paths only — PocketBase does NOT expand ~; a fresh pb_data auto-applies migrations.
"$PB_BIN" serve \
	--http="127.0.0.1:${PB_PORT}" \
	--dir="$PB_BACKEND_DIR/pb_data" \
	--migrationsDir="$PB_BACKEND_DIR/pb_migrations" \
	--hooksDir="$PB_BACKEND_DIR/pb_hooks" \
	--publicDir="$PB_BACKEND_DIR/pb_public" &
PB_PID=$!

echo -n "  waiting for PocketBase"
for _ in $(seq 1 30); do
	if curl -sf -o /dev/null "$PB_URL/api/health"; then echo " — up"; break; fi
	if ! kill -0 "$PB_PID" 2>/dev/null; then echo; echo "PocketBase exited early." >&2; exit 1; fi
	echo -n "."; sleep 1
done
curl -sf -o /dev/null "$PB_URL/api/health" || { echo "PocketBase did not become healthy." >&2; exit 1; }

echo "▶ Ensuring superuser $PB_SUPERUSER_EMAIL …"
"$PB_BIN" superuser upsert "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD" --dir="$PB_BACKEND_DIR/pb_data" >/dev/null

if [[ -n "$SEED_SCENARIO" ]]; then
	echo "▶ Seeding scenario '$SEED_SCENARIO' …"
	PB_URL="$PB_URL" PB_SUPERUSER_EMAIL="$PB_SUPERUSER_EMAIL" PB_SUPERUSER_PASSWORD="$PB_SUPERUSER_PASSWORD" \
		npm run --silent seed -- "$SEED_SCENARIO"
fi

if [[ "$START_WEB" -eq 0 ]]; then
	echo "▶ PB ready at $PB_URL (superuser: $PB_SUPERUSER_EMAIL). Press Ctrl-C to stop."
	wait "$PB_PID"
	exit 0
fi

echo "▶ Starting SvelteKit dev server on http://127.0.0.1:${WEB_PORT} …"
# Trailing slash matters (itemImageUrl builds `${PUBLIC_PB_URL}api/files/…`); HTTP (no mkcert)
# so the page and PB images share a scheme.
PUBLIC_PB_URL="${PB_URL}/" DEV_DISABLE_MKCERT=true \
	npm run dev -- --host 127.0.0.1 --port "$WEB_PORT"
