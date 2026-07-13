#!/bin/bash
# MenRush pre-deployment gate: production builds + live API feature/contract checks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> Backend production build"
(cd backend && npm run build)

echo "==> Frontend production build"
(cd frontend && npm run build)

echo "==> Feature + contract tests (requires API on :3000)"
API_URL="${API_URL:-http://localhost:3000/api}" \
BETA_INVITE_CODE="${BETA_INVITE_CODE:-TESTBETA}" \
  bash "$ROOT/test-features.sh"

echo "==> Pre-deploy gate complete"
