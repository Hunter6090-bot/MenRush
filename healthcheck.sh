#!/usr/bin/env bash
# healthcheck.sh — MenRush deployment & local-stack health probe.
#
# Runs five checks and prints PASS/FAIL for each, then a summary.
#   1. menrush.com returns HTTP 200
#   2. Waitlist API accepts a test email
#   3. Database connection is alive
#   4. Required env vars are set
#   5. Docker containers are running
#
# Usage:
#   ./healthcheck.sh                       # use defaults
#   PROD_URL=https://staging.menrush.com \
#   API_URL=http://localhost:3000 \
#     ./healthcheck.sh
#
# On any failure, the script alerts:
#   - emails ALERT_EMAIL (default: al@menrush.com) via local mail/mailx/sendmail
#   - POSTs to ALERT_WEBHOOK if set (Slack-compatible {"text": ...} body)
# Disable with ALERT_DISABLE=1.
#
# Exit code: number of failed checks (0 = all green).

set -u

# ─── Config ───────────────────────────────────────────────────────────────────
PROD_URL="${PROD_URL:-https://menrush.com}"
API_URL="${API_URL:-http://localhost:3000}"
WAITLIST_ENDPOINT="${WAITLIST_ENDPOINT:-$API_URL/api/waitlist}"
WAITLIST_TEST_EMAIL="${WAITLIST_TEST_EMAIL:-healthcheck+$(date +%s)@menrush.test}"
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"

# Failure alerting. Either is enough; if both are set, both fire.
#   ALERT_EMAIL    — recipient address (uses local mail/mailx/sendmail)
#   ALERT_WEBHOOK  — Slack/Discord/Zapier-style webhook accepting {"text": ...}
#   ALERT_DISABLE  — set to 1 to silence alerts entirely (useful when piping)
ALERT_EMAIL="${ALERT_EMAIL:-al@menrush.com}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
ALERT_DISABLE="${ALERT_DISABLE:-0}"

REQUIRED_ENV_VARS=(
  DATABASE_URL
  JWT_SECRET
  FRONTEND_URL
  PORT
)
OPTIONAL_ENV_VARS=(
  NODE_ENV
  VAPID_PUBLIC_KEY
  VAPID_PRIVATE_KEY
  VAPID_EMAIL
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
)

EXPECTED_CONTAINERS=(
  menrush-db
  menrush-backend
)

# ─── Colours (auto-disable if not a TTY or NO_COLOR set) ──────────────────────
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'
  C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_YELLOW=$'\033[33m'; C_DIM=$'\033[2m'
else
  C_RESET=""; C_BOLD=""; C_GREEN=""; C_RED=""; C_YELLOW=""; C_DIM=""
fi

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  RESULTS+=("PASS|$1|$2")
  printf '  %s[PASS]%s %s %s%s%s\n' "$C_GREEN" "$C_RESET" "$1" "$C_DIM" "$2" "$C_RESET"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  RESULTS+=("FAIL|$1|$2")
  printf '  %s[FAIL]%s %s %s%s%s\n' "$C_RED" "$C_RESET" "$1" "$C_DIM" "$2" "$C_RESET"
}

section() {
  printf '\n%s%s%s\n' "$C_BOLD" "$1" "$C_RESET"
}

# ─── Load .env (best-effort) so checks see backend config ─────────────────────
load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  # Only export simple KEY=VALUE lines; ignore comments and exports.
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$file" | sed -e 's/\r$//')
  set +a
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/backend/.env"

# ─── 1. menrush.com returns 200 ───────────────────────────────────────────────
check_site() {
  section "1. Production site ($PROD_URL)"
  if ! command -v curl >/dev/null 2>&1; then
    fail "site reachable" "curl not installed"
    return
  fi
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' \
    --max-time "$CURL_TIMEOUT" -L "$PROD_URL" 2>/dev/null) || code="000"
  [[ -z "$code" ]] && code="000"
  if [[ "$code" == "200" ]]; then
    pass "HTTP 200" "$PROD_URL"
  else
    fail "HTTP $code" "$PROD_URL (expected 200)"
  fi
}

# ─── 2. Waitlist API accepts a test email ─────────────────────────────────────
check_waitlist() {
  section "2. Waitlist API ($WAITLIST_ENDPOINT)"
  if ! command -v curl >/dev/null 2>&1; then
    fail "POST waitlist" "curl not installed"
    return
  fi
  local code
  code=$(curl -sS --max-time "$CURL_TIMEOUT" \
    -o /tmp/healthcheck_waitlist.$$ \
    -w '%{http_code}' \
    -X POST "$WAITLIST_ENDPOINT" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$WAITLIST_TEST_EMAIL\"}" 2>/dev/null) || code="000"
  [[ -z "$code" ]] && code="000"
  local response_body=""
  [[ -f /tmp/healthcheck_waitlist.$$ ]] && response_body=$(cat /tmp/healthcheck_waitlist.$$)
  rm -f /tmp/healthcheck_waitlist.$$
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    pass "POST $code" "accepted $WAITLIST_TEST_EMAIL"
  else
    fail "POST $code" "${response_body:0:120}"
  fi
}

# ─── 3. Database connection is alive ──────────────────────────────────────────
parse_db_url() {
  # Sets globals: DB_USER DB_PASS DB_HOST DB_PORT DB_NAME from $DATABASE_URL.
  local url="${DATABASE_URL:-}"
  [[ -n "$url" ]] || return 1
  # postgresql://user:pass@host:port/db[?...]
  local re='^postgres(ql)?://([^:]+):([^@]*)@([^:/]+):([0-9]+)/([^?]+)'
  if [[ "$url" =~ $re ]]; then
    DB_USER="${BASH_REMATCH[2]}"
    DB_PASS="${BASH_REMATCH[3]}"
    DB_HOST="${BASH_REMATCH[4]}"
    DB_PORT="${BASH_REMATCH[5]}"
    DB_NAME="${BASH_REMATCH[6]}"
    return 0
  fi
  return 1
}

check_db() {
  section "3. Database connection"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    fail "DB connection" "DATABASE_URL not set"
    return
  fi
  if ! parse_db_url; then
    fail "DB connection" "could not parse DATABASE_URL"
    return
  fi

  # Prefer psql if installed.
  if command -v psql >/dev/null 2>&1; then
    if PGPASSWORD="$DB_PASS" psql \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -tA -c 'SELECT 1' >/dev/null 2>&1; then
      pass "psql SELECT 1" "$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
      return
    fi
  fi

  # Fall back to running psql inside the postgres container.
  if command -v docker >/dev/null 2>&1 && \
     docker ps --format '{{.Names}}' 2>/dev/null | grep -qx menrush-db; then
    if docker exec menrush-db \
        psql -U "$DB_USER" -d "$DB_NAME" -tA -c 'SELECT 1' >/dev/null 2>&1; then
      pass "docker exec psql" "menrush-db ($DB_NAME)"
      return
    fi
  fi

  # Last resort: TCP probe so we at least know the port answers.
  if command -v nc >/dev/null 2>&1 && nc -z -w 3 "$DB_HOST" "$DB_PORT" >/dev/null 2>&1; then
    fail "DB query" "TCP open on $DB_HOST:$DB_PORT but psql unavailable"
  else
    fail "DB unreachable" "$DB_HOST:$DB_PORT"
  fi
}

# ─── 4. All required env vars are set ─────────────────────────────────────────
check_env_vars() {
  section "4. Environment variables"
  local missing=()
  local placeholders=()
  for var in "${REQUIRED_ENV_VARS[@]}"; do
    local val="${!var:-}"
    if [[ -z "$val" ]]; then
      missing+=("$var")
    elif [[ "$val" == *change-me* || "$val" == *change-this* || \
            "$val" == *__SET_ME__* || "$val" == "your-secret-key" ]]; then
      placeholders+=("$var")
    fi
  done

  if [[ ${#missing[@]} -eq 0 && ${#placeholders[@]} -eq 0 ]]; then
    pass "required vars" "${REQUIRED_ENV_VARS[*]}"
  else
    local detail=""
    [[ ${#missing[@]} -gt 0 ]] && detail="missing: ${missing[*]}"
    [[ ${#placeholders[@]} -gt 0 ]] && \
      detail="${detail:+$detail; }placeholder values: ${placeholders[*]}"
    fail "required vars" "$detail"
  fi

  # Soft check for optional vars — never fails the run, just informational.
  local opt_missing=()
  for var in "${OPTIONAL_ENV_VARS[@]}"; do
    local val="${!var:-}"
    if [[ -z "$val" || "$val" == *__SET_ME__* ]]; then
      opt_missing+=("$var")
    fi
  done
  if [[ ${#opt_missing[@]} -gt 0 ]]; then
    printf '  %s[INFO]%s optional unset: %s\n' \
      "$C_YELLOW" "$C_RESET" "${opt_missing[*]}"
  fi
}

# ─── 5. Docker containers are running ─────────────────────────────────────────
check_docker() {
  section "5. Docker containers"
  if ! command -v docker >/dev/null 2>&1; then
    fail "docker available" "docker CLI not installed"
    return
  fi
  if ! docker info >/dev/null 2>&1; then
    fail "docker daemon" "cannot connect to docker daemon"
    return
  fi

  local running
  running=$(docker ps --format '{{.Names}}' 2>/dev/null)
  local all_up=1
  for name in "${EXPECTED_CONTAINERS[@]}"; do
    if grep -qx "$name" <<<"$running"; then
      pass "container up" "$name"
    else
      fail "container down" "$name"
      all_up=0
    fi
  done
  if [[ $all_up -eq 1 ]]; then
    printf '  %s[INFO]%s all expected containers running\n' "$C_DIM" "$C_RESET"
  fi
}

# ─── Run all checks ───────────────────────────────────────────────────────────
printf '%sMenRush health check%s — %s\n' \
  "$C_BOLD" "$C_RESET" "$(date '+%Y-%m-%d %H:%M:%S %Z')"

check_site
check_waitlist
check_db
check_env_vars
check_docker

# ─── Summary ──────────────────────────────────────────────────────────────────
TOTAL=$((PASS_COUNT + FAIL_COUNT))
printf '\n%sSummary%s  %s%d passed%s, %s%d failed%s (%d total)\n' \
  "$C_BOLD" "$C_RESET" \
  "$C_GREEN" "$PASS_COUNT" "$C_RESET" \
  "$C_RED" "$FAIL_COUNT" "$C_RESET" \
  "$TOTAL"

if [[ $FAIL_COUNT -gt 0 ]]; then
  printf '%sFAILED:%s\n' "$C_RED" "$C_RESET"
  for r in "${RESULTS[@]}"; do
    if [[ "$r" == FAIL\|* ]]; then
      printf '  - %s\n' "${r#FAIL|}"
    fi
  done
fi

# ─── Alerting ─────────────────────────────────────────────────────────────────
# Minimal JSON string escaper for webhook payloads. Reads stdin → stdout.
json_escape() {
  local s
  s=$(cat)
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\r'/}"
  s="${s//$'\t'/\\t}"
  s="${s//$'\n'/\\n}"
  printf '%s' "$s"
}

build_alert_body() {
  local hostname
  hostname=$(hostname 2>/dev/null || echo unknown)
  {
    printf 'MenRush healthcheck FAILED\n'
    printf '  When: %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')"
    printf '  Host: %s\n' "$hostname"
    printf '  Site: %s\n' "$PROD_URL"
    printf '  API:  %s\n' "$API_URL"
    printf '  Result: %d passed, %d failed (%d total)\n' "$PASS_COUNT" "$FAIL_COUNT" "$TOTAL"
    printf '\nFailing checks:\n'
    for r in "${RESULTS[@]}"; do
      [[ "$r" == FAIL\|* ]] && printf '  - %s\n' "${r#FAIL|}"
    done
  }
}

send_alert() {
  local subject body
  subject="[MenRush] healthcheck FAIL — $FAIL_COUNT check(s) down"
  body=$(build_alert_body)

  local sent=0 attempted=0

  # 1. Webhook (Slack-compatible JSON body).
  if [[ -n "$ALERT_WEBHOOK" ]] && command -v curl >/dev/null 2>&1; then
    attempted=1
    local text_payload
    text_payload=$(printf '*%s*\n```\n%s\n```' "$subject" "$body" | json_escape)
    local json="{\"text\":\"$text_payload\"}"
    if curl -sS --max-time 10 -X POST \
         -H 'Content-Type: application/json' \
         -d "$json" "$ALERT_WEBHOOK" >/dev/null 2>&1; then
      sent=1
      printf '%s[ALERT]%s webhook notified\n' "$C_YELLOW" "$C_RESET"
    else
      printf '%s[ALERT]%s webhook POST failed\n' "$C_RED" "$C_RESET"
    fi
  fi

  # 2. Email via local mailer. Try mail, then mailx, then sendmail.
  if [[ -n "$ALERT_EMAIL" ]]; then
    attempted=1
    if command -v mail >/dev/null 2>&1 && \
       printf '%s\n' "$body" | mail -s "$subject" "$ALERT_EMAIL" 2>/dev/null; then
      sent=1
      printf '%s[ALERT]%s emailed %s via mail(1)\n' "$C_YELLOW" "$C_RESET" "$ALERT_EMAIL"
    elif command -v mailx >/dev/null 2>&1 && \
         printf '%s\n' "$body" | mailx -s "$subject" "$ALERT_EMAIL" 2>/dev/null; then
      sent=1
      printf '%s[ALERT]%s emailed %s via mailx(1)\n' "$C_YELLOW" "$C_RESET" "$ALERT_EMAIL"
    elif command -v sendmail >/dev/null 2>&1 && {
           printf 'To: %s\nSubject: %s\nContent-Type: text/plain; charset=UTF-8\n\n%s\n' \
             "$ALERT_EMAIL" "$subject" "$body" | sendmail -t 2>/dev/null;
         }; then
      sent=1
      printf '%s[ALERT]%s emailed %s via sendmail(1)\n' "$C_YELLOW" "$C_RESET" "$ALERT_EMAIL"
    fi
  fi

  if [[ $attempted -eq 0 ]]; then
    printf '%s[ALERT]%s no recipient configured (ALERT_EMAIL/ALERT_WEBHOOK empty)\n' \
      "$C_YELLOW" "$C_RESET"
  elif [[ $sent -eq 0 ]]; then
    printf '%s[ALERT]%s could not deliver (no working mailer; set ALERT_WEBHOOK)\n' \
      "$C_RED" "$C_RESET"
  fi
}

if [[ $FAIL_COUNT -gt 0 && "$ALERT_DISABLE" != "1" ]]; then
  send_alert
fi

exit "$FAIL_COUNT"
