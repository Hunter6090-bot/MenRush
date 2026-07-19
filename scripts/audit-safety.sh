#!/usr/bin/env bash
# Pre-push malware audit: scans the two MCP-attack target files for known exfil patterns.
set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGETS=(
  "$REPO_ROOT/frontend/src/api/client.ts"
  "$REPO_ROOT/backend/src/server.ts"
)
# Known MCP malware fingerprints. A legitimate axios response interceptor
# (e.g. session-expired logout) is allowed — only exfil targets fail.
PATTERNS=(
  '127\.0\.0\.1:7779'
  'localhost:7779'
  '/ingest/'
  '09053abd-7c78-4d98-a2a7-cdb7b1a66b66'
)

failures=0
for file in "${TARGETS[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "❌ MISSING: $file"
    failures=$((failures + 1))
    continue
  fi
  for pat in "${PATTERNS[@]}"; do
    matches=$(grep -nE "$pat" "$file" || true)
    if [[ -n "$matches" ]]; then
      echo "❌ FAIL: $file — pattern /$pat/"
      while IFS= read -r line; do
        echo "    $line"
      done <<< "$matches"
      failures=$((failures + 1))
    fi
  done
done

if [[ $failures -eq 0 ]]; then
  echo "✅ Safety audit passed — both files clean."
  exit 0
else
  echo ""
  echo "❌ Safety audit FAILED with $failures finding(s). Do not push."
  exit 1
fi
