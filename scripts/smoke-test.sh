#!/usr/bin/env bash
# Post-deploy smoke test: the key pages answer 200 and the curated content
# bundle made it into the Worker. Retries while a new version propagates.
#
# Usage:  scripts/smoke-test.sh https://quang-tri-travel-agent.<subdomain>.workers.dev
set -euo pipefail

BASE="${1:?usage: smoke-test.sh <base-url>}"
BASE="${BASE%/}"
ATTEMPTS=10

check() {
  local path="$1" expect="${2:-}"
  for ((i = 1; i <= ATTEMPTS; i++)); do
    body=$(curl -fsS --max-time 20 "$BASE$path" 2>/dev/null) &&
      { [[ -z "$expect" ]] || grep -qE "$expect" <<<"$body"; } &&
      { echo "ok   $path"; return 0; }
    sleep 3
  done
  echo "FAIL $path${expect:+ (expected \"$expect\")}" >&2
  return 1
}

check /
check /chat
check /map
check /api/sites
# Proves the build-time content bundle is in the Worker.
check /site/vinh-moc "Vĩnh Mốc"
# Quiz bundle reached the Worker, and the passport renders.
check /site/vinh-moc/quiz "Vinh Moc|Vĩnh Mốc"
check /passport
# Photos are served from our own Cloudflare assets (bun run photos:fetch).
check /photos/vinh-moc-480.webp
