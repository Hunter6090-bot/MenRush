#!/bin/bash
# MenRush - Pre-deployment Feature Verification
# Covers: env safety, beta invite, auth, location, discovery, photo, likes/matches,
# messaging, verification contract, optional adult-assurance enforcement.
#
# SAFETY: Creates disposable users. Only run against an isolated test database.
#   ALLOW_DESTRUCTIVE_TESTS=true is required.
#   Production API hosts are refused.

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000/api}"
# Codes must match invite service: normalize to MENRUSH + 8 chars (e.g. MENRUSH-TEST-BETA)
BETA_CODE="${BETA_INVITE_CODE:-MENRUSH-TEST-BETA}"
PASS=0
FAIL=0
TMPDIR_MR="$(mktemp -d "${TMPDIR:-/tmp}/menrush-predeploy.XXXXXX")"
trap 'rm -rf "$TMPDIR_MR"' EXIT

ok() { echo "✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "❌ $1"; FAIL=$((FAIL + 1)); }
die() { echo "❌ $1"; exit 1; }

# Refuse known production hosts (never create disposable users there).
API_HOST="$(python3 - "$API_URL" <<'PY'
import sys
from urllib.parse import urlparse
u = urlparse(sys.argv[1] if "://" in sys.argv[1] else "http://" + sys.argv[1])
print((u.hostname or "").lower())
PY
)"
case "$API_HOST" in
  localhost|127.0.0.1|::1|0.0.0.0) ;;
  *.railway.internal|*.rlwy.net) ;;
  menrush.com|www.menrush.com|api.menrush.com|backend-production-d587.up.railway.app)
    die "Refusing to run destructive predeploy tests against production host: $API_HOST"
    ;;
  *)
    # Non-local hosts require an explicit override in addition to ALLOW_DESTRUCTIVE_TESTS.
    if [ "${ALLOW_REMOTE_DESTRUCTIVE_TESTS:-}" != "true" ]; then
      die "Refusing non-local API host '$API_HOST'. Set ALLOW_REMOTE_DESTRUCTIVE_TESTS=true only for an isolated staging API."
    fi
    ;;
esac

[ "${ALLOW_DESTRUCTIVE_TESTS:-}" = "true" ] || \
  die "Set ALLOW_DESTRUCTIVE_TESTS=true in an isolated test environment"

json_field() {
  python3 - "$1" "$2" <<'PY'
import json,sys
data=json.loads(sys.argv[1])
key=sys.argv[2]
cur=data
for part in key.split('.'):
    if isinstance(cur, dict) and part in cur:
        cur=cur[part]
    else:
        print('')
        sys.exit(0)
if isinstance(cur, bool):
    print('true' if cur else 'false')
elif cur is None:
    print('')
else:
    print(cur)
PY
}

# curl_json METHOD URL [curl args...]
# Sets: HTTP_CODE, HTTP_BODY
curl_json() {
  local method="$1"; shift
  local url="$1"; shift
  local body_file="$TMPDIR_MR/body.$$.$RANDOM"
  HTTP_CODE="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" "$@" || echo "000")"
  HTTP_BODY="$(cat "$body_file" 2>/dev/null || true)"
  rm -f "$body_file"
}

require_status() {
  local expected="$1"
  local label="$2"
  if [ "$HTTP_CODE" != "$expected" ]; then
    bad "$label: expected HTTP $expected, got $HTTP_CODE — ${HTTP_BODY:0:240}"
    return 1
  fi
  return 0
}

require_json() {
  local label="$1"
  if ! python3 -c 'import json,sys; json.loads(sys.argv[1])' "$HTTP_BODY" 2>/dev/null; then
    bad "$label: response is not valid JSON — ${HTTP_BODY:0:240}"
    return 1
  fi
  return 0
}

array_contains_id() {
  # usage: array_contains_id '<json-array>' '<user-id>'
  python3 - "$1" "$2" <<'PY'
import json,sys
data=json.loads(sys.argv[1])
uid=sys.argv[2]
if not isinstance(data, list):
    sys.exit(1)
for row in data:
    if isinstance(row, dict) and str(row.get('id') or row.get('user_id') or row.get('other_user_id') or '') == uid:
        sys.exit(0)
sys.exit(1)
PY
}

echo "🧪 MenRush pre-deployment feature checks"
echo "API: $API_URL"
echo "--------------------------------"

# 0. Health / reachability
curl_json POST "$API_URL/auth/login" -H 'Content-Type: application/json' -d '{}'
if [ "$HTTP_CODE" = "000" ]; then
  die "Backend not reachable at $API_URL"
fi
ok "Backend reachable (login probe HTTP $HTTP_CODE)"

# 1. Beta invite validation
echo "🎟️  Validating beta invite..."
curl_json POST "$API_URL/beta/validate-invite" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$BETA_CODE\"}"
if require_status 200 "Beta invite validate" && require_json "Beta invite validate"; then
  if [ "$(json_field "$HTTP_BODY" "valid")" = "true" ]; then
    ok "Beta invite accepted"
  else
    die "Beta invite not valid: $HTTP_BODY"
  fi
fi

curl_json POST "$API_URL/beta/validate-invite" \
  -H "Content-Type: application/json" \
  -d '{"code":"NOT-A-REAL-CODE"}'
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
  ok "Invalid beta invite rejected (HTTP $HTTP_CODE)"
else
  bad "Invalid beta invite should fail, got HTTP $HTTP_CODE: $HTTP_BODY"
fi

# 2. Register User 1 (Alice)
echo "👤 Registering Alice..."
SUFFIX=$(date +%s)
curl_json POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"alice+predeploy-$SUFFIX@test.local\",\"password\":\"password123\",\"name\":\"Alice\",\"age\":25,\"invite_code\":\"$BETA_CODE\"}"
require_status 201 "Alice register" || die "Alice registration failed"
require_json "Alice register" || die "Alice registration invalid JSON"
TOKEN1=$(json_field "$HTTP_BODY" "token")
USER1_ID=$(json_field "$HTTP_BODY" "user.id")
[ -n "$TOKEN1" ] && [ -n "$USER1_ID" ] || die "Alice registration missing token/id: $HTTP_BODY"
ok "Alice registered ($USER1_ID)"

# 3. Register User 2 (Bob)
echo "👤 Registering Bob..."
curl_json POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"bob+predeploy-$SUFFIX@test.local\",\"password\":\"password123\",\"name\":\"Bob\",\"age\":28,\"invite_code\":\"$BETA_CODE\"}"
require_status 201 "Bob register" || die "Bob registration failed"
require_json "Bob register" || die "Bob registration invalid JSON"
TOKEN2=$(json_field "$HTTP_BODY" "token")
USER2_ID=$(json_field "$HTTP_BODY" "user.id")
[ -n "$TOKEN2" ] && [ -n "$USER2_ID" ] || die "Bob registration missing token/id: $HTTP_BODY"
ok "Bob registered ($USER2_ID)"

# 4. Login
echo "🔐 Testing login..."
curl_json POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"alice+predeploy-$SUFFIX@test.local\",\"password\":\"password123\"}"
require_status 200 "Login" || die "Login failed"
require_json "Login" || die "Login invalid JSON"
LOGIN_BODY="$HTTP_BODY"
LOGIN_TOKEN=$(json_field "$LOGIN_BODY" "token")
LOGIN_USER_ID=$(json_field "$LOGIN_BODY" "user.id")
[ -n "$LOGIN_TOKEN" ] || die "Login missing token: $LOGIN_BODY"
[ "$LOGIN_USER_ID" = "$USER1_ID" ] || die "Login user.id mismatch: $LOGIN_USER_ID != $USER1_ID"
ok "Login works"

# 5. Locations
echo "📍 Updating locations..."
# Use obviously synthetic coords far from real UK launch cities to reduce pollution risk.
curl_json POST "$API_URL/users/location" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"lat":-89.9001,"lng":179.9001}'
require_status 200 "Alice location" || bad "Alice location update failed"
require_json "Alice location" || true
if [ "$(json_field "$HTTP_BODY" "success")" = "true" ] || [ "$HTTP_CODE" = "200" ]; then
  ok "Alice location updated"
fi

curl_json POST "$API_URL/users/location" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"lat":-89.9002,"lng":179.9002}'
require_status 200 "Bob location" || bad "Bob location update failed"
ok "Bob location updated"

# 6. Profile photo upload
echo "🖼️  Testing profile photo upload..."
printf '\xff\xd8\xff\xd9' > "$TMPDIR_MR/dummy.jpg"
curl_json POST "$API_URL/users/photo" \
  -H "Authorization: Bearer $TOKEN1" \
  -F "photo=@$TMPDIR_MR/dummy.jpg;type=image/jpeg"
if require_status 200 "Photo upload" && require_json "Photo upload"; then
  PHOTO_URL=$(json_field "$HTTP_BODY" "photo_url")
  if [ -n "$PHOTO_URL" ]; then
    ok "Photo upload ($PHOTO_URL)"
  else
    bad "Photo upload missing photo_url: $HTTP_BODY"
  fi
fi

# 7. Discovery / nearby
echo "🔍 Testing nearby discovery..."
curl_json GET "$API_URL/users/nearby?lat=-89.9001&lng=179.9001&radius=50" \
  -H "Authorization: Bearer $TOKEN1"
if require_status 200 "Nearby" && require_json "Nearby"; then
  if array_contains_id "$HTTP_BODY" "$USER2_ID"; then
    ok "Nearby discovery found Bob by id"
  else
    bad "Nearby discovery missed Bob id $USER2_ID: ${HTTP_BODY:0:240}"
  fi
fi

curl_json GET "$API_URL/users/nearby?lat=-89.9001&lng=179.9001&minAge=18&maxAge=20&radius=50" \
  -H "Authorization: Bearer $TOKEN1"
if require_status 200 "Age filter empty" && require_json "Age filter empty"; then
  if [ "$HTTP_BODY" = "[]" ]; then
    ok "Age filter 18-20 empty"
  else
    bad "Age filter 18-20 expected [] got: ${HTTP_BODY:0:240}"
  fi
fi

curl_json GET "$API_URL/users/nearby?lat=-89.9001&lng=179.9001&minAge=25&maxAge=30&radius=50" \
  -H "Authorization: Bearer $TOKEN1"
if require_status 200 "Age filter hit" && require_json "Age filter hit"; then
  if array_contains_id "$HTTP_BODY" "$USER2_ID"; then
    ok "Age filter 25-30 found Bob by id"
  else
    bad "Age filter 25-30 missed Bob id $USER2_ID: ${HTTP_BODY:0:240}"
  fi
fi

# 8. Likes & matches
echo "❤️  Testing likes & matches..."
curl_json POST "$API_URL/users/like/$USER2_ID" -H "Authorization: Bearer $TOKEN1"
require_status 200 "Alice likes Bob" || bad "Alice like failed"
require_json "Alice likes Bob" || true
LIKE1="$HTTP_BODY"

curl_json POST "$API_URL/users/like/$USER1_ID" -H "Authorization: Bearer $TOKEN2"
if require_status 200 "Bob likes Alice" && require_json "Bob likes Alice"; then
  if [ "$(json_field "$HTTP_BODY" "match")" = "true" ]; then
    ok "Mutual like created a match"
  else
    bad "Match failed: like1=$LIKE1 like2=$HTTP_BODY"
  fi
fi

curl_json GET "$API_URL/users/matches" -H "Authorization: Bearer $TOKEN1"
if require_status 200 "Matches list" && require_json "Matches list"; then
  if array_contains_id "$HTTP_BODY" "$USER2_ID"; then
    ok "Bob listed in Alice matches by id"
  else
    bad "Matches list missing Bob id $USER2_ID: ${HTTP_BODY:0:240}"
  fi
fi

# 9. Messaging
echo "💬 Testing messaging..."
curl_json POST "$API_URL/messages" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d "{\"receiver_id\":\"$USER2_ID\",\"message\":\"hey bob from alice\"}"
if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  bad "Send message expected 200/201, got $HTTP_CODE — ${HTTP_BODY:0:240}"
elif require_json "Send message"; then
  MSG_ID=$(json_field "$HTTP_BODY" "id")
  MSG_RECEIVER=$(json_field "$HTTP_BODY" "receiver_id")
  if [ -n "$MSG_ID" ] && [ "$MSG_RECEIVER" = "$USER2_ID" ]; then
    ok "Message sent ($MSG_ID)"
  else
    bad "Send message missing id/receiver: $HTTP_BODY"
  fi
fi

curl_json GET "$API_URL/messages/conversation/$USER2_ID" \
  -H "Authorization: Bearer $TOKEN1"
if require_status 200 "Conversation" && require_json "Conversation"; then
  if echo "$HTTP_BODY" | grep -q "hey bob from alice"; then
    ok "Conversation history contains message"
  else
    bad "Conversation missing message: ${HTTP_BODY:0:240}"
  fi
fi

curl_json GET "$API_URL/messages/conversations" \
  -H "Authorization: Bearer $TOKEN1"
if require_status 200 "Conversations list" && require_json "Conversations list"; then
  if array_contains_id "$HTTP_BODY" "$USER2_ID"; then
    ok "Conversations list includes Bob by id"
  else
    bad "Conversations list missing Bob id $USER2_ID: ${HTTP_BODY:0:240}"
  fi
fi

# 10. Auth guard
echo "🔒 Testing auth guard..."
curl_json GET "$API_URL/users/matches"
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  ok "Unauthenticated matches request blocked ($HTTP_CODE)"
else
  bad "Expected 401/403 for unauth matches, got $HTTP_CODE"
fi

# 11. Verification contract — strict authenticated + unauthenticated checks
echo "🪪 Checking verification API contract..."
# Unauthenticated first
curl_json GET "$API_URL/verify/status"
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  ok "Unauthenticated verify/status blocked ($HTTP_CODE)"
else
  bad "Unauthenticated verify/status expected 401/403, got $HTTP_CODE"
fi

# Authenticated — must be 200 with recognised backend state (not browser-mocked)
curl_json GET "$API_URL/verify/status" -H "Authorization: Bearer $TOKEN1"
if require_status 200 "Authenticated verify/status" && require_json "Authenticated verify/status"; then
  V_STATUS=$(json_field "$HTTP_BODY" "status")
  V_TRUST=$(json_field "$HTTP_BODY" "trust_level")
  V_AGE=$(json_field "$HTTP_BODY" "age_assurance_status")
  V_IS=$(json_field "$HTTP_BODY" "is_verified")
  case "$V_STATUS" in
    unverified|pending|verified|rejected|"")
      # empty status tolerated only if trust_level/age fields present
      ;;
    *)
      bad "Unrecognised verification status: $V_STATUS"
      ;;
  esac
  case "$V_TRUST" in
    unconfirmed|adult_confirmed|authentic_person|identity_checked)
      ok "verify/status trust_level=$V_TRUST age_assurance=$V_AGE is_verified=$V_IS"
      ;;
    *)
      # Some backends may omit trust_level — require at least age_assurance or is_verified
      if [ -n "$V_AGE" ] || [ -n "$V_IS" ]; then
        ok "verify/status returned backend state (age_assurance=$V_AGE is_verified=$V_IS)"
      else
        bad "verify/status missing recognised trust/age fields: $HTTP_BODY"
      fi
      ;;
  esac
fi

# Login payload verification fields (backend-sourced)
HAS_VERIFIED=$(json_field "$LOGIN_BODY" "user.is_verified")
HAS_VSTATUS=$(json_field "$LOGIN_BODY" "user.verification_status")
HAS_AGE=$(json_field "$LOGIN_BODY" "user.age_assurance_status")
if [ -n "$HAS_VERIFIED" ] || [ -n "$HAS_VSTATUS" ] || [ -n "$HAS_AGE" ]; then
  ok "Login payload includes verification/assurance fields from backend"
else
  bad "Login user payload lacks is_verified/verification_status/age_assurance_status"
fi

# 12. Adult-assurance enforcement (backend, not frontend redirects)
# When ADULT_ASSURANCE_ENFORCED=true, unassured users must be blocked from discovery.
# Until Codex wires mandatory adult assurance, default is to assert the status surface only.
echo "🛡️  Adult-assurance enforcement checks..."
if [ "${ADULT_ASSURANCE_ENFORCED:-}" = "true" ]; then
  AGE_STATE=$(json_field "$(curl -sS -H "Authorization: Bearer $TOKEN1" "$API_URL/verify/status")" "age_assurance_status")
  if [ "$AGE_STATE" = "confirmed" ]; then
    bad "Expected fresh test user to be unassured, got age_assurance_status=$AGE_STATE"
  else
    curl_json GET "$API_URL/users/nearby?lat=-89.9001&lng=179.9001&radius=50" \
      -H "Authorization: Bearer $TOKEN1"
    if [ "$HTTP_CODE" = "403" ]; then
      ok "Unassured user blocked from discovery (HTTP 403)"
    else
      bad "ADULT_ASSURANCE_ENFORCED: unassured discovery expected 403, got $HTTP_CODE"
    fi
    curl_json GET "$API_URL/users/matches" -H "Authorization: Bearer $TOKEN1"
    if [ "$HTTP_CODE" = "403" ]; then
      ok "Unassured user blocked from matches (HTTP 403)"
    else
      bad "ADULT_ASSURANCE_ENFORCED: unassured matches expected 403, got $HTTP_CODE"
    fi
    curl_json POST "$API_URL/messages" \
      -H "Authorization: Bearer $TOKEN1" \
      -H "Content-Type: application/json" \
      -d "{\"receiver_id\":\"$USER2_ID\",\"message\":\"should be blocked\"}"
    if [ "$HTTP_CODE" = "403" ]; then
      ok "Unassured user blocked from messaging (HTTP 403)"
    else
      bad "ADULT_ASSURANCE_ENFORCED: unassured messaging expected 403, got $HTTP_CODE"
    fi
  fi
else
  ok "Adult-assurance enforcement deferred (set ADULT_ASSURANCE_ENFORCED=true when Codex wires the gate)"
fi

# 13. Health endpoint
curl_json GET "${API_URL%/api}/health"
if require_status 200 "Health" && require_json "Health"; then
  ok "Health endpoint OK"
fi

echo "--------------------------------"
echo "Passed: $PASS  Failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "✨ PRE-DEPLOY CHECKS FAILED"
  exit 1
fi
echo "✨ ALL PRE-DEPLOY FEATURE TESTS PASSED"
exit 0
