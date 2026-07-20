#!/usr/bin/env bash
# MenRush autonomous CEO loop — every 3 minutes, headless grok continues the session.
set -euo pipefail

INTERVAL_SEC="${MENRUSH_LOOP_INTERVAL_SEC:-180}"
GROK_CLI="${GROK_CLI:-$HOME/.local/bin/grok-cli}"
SESSION="${MENRUSH_SESSION:-menrush-autonomous}"
LOG="$HOME/.grok/autonomous/${SESSION}-loop.log"

mkdir -p "$(dirname "$LOG")"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] menrush autonomous loop started (interval=${INTERVAL_SEC}s)" | tee -a "$LOG"

while true; do
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] cycle start" | tee -a "$LOG"
  if echo "continue" | "$GROK_CLI" --session "$SESSION"; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] cycle ok" | tee -a "$LOG"
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] cycle failed (exit $?)" | tee -a "$LOG"
  fi
  sleep "$INTERVAL_SEC"
done