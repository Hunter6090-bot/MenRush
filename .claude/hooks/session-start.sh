#!/bin/bash
set -euo pipefail

# Installs project dependencies once the repo is checked out.
# The environment setup script only installs global tools (typescript, ts-node,
# postgresql-client) since it runs before the repo is cloned.

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/backend" && npm install
cd "$CLAUDE_PROJECT_DIR/frontend" && npm install
