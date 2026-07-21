#!/bin/bash
# MenRush - Pre-deployment Feature Verification
# Covers: beta invite gate, auth, location, discovery, photo, likes/matches, messaging

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000/api}"
# Codes must match invite service: normalize to MENRUSH + 8 chars (e.g. MENRUSH-TEST-BETA)
BETA_CODE="${BETA_INVITE_CODE:-MENRUSH-TEST-BETA}"
PASS=0
FAIL=0

ok() { echo "✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "❌ $1"; FAIL=$((FAIL + 1)); }
die() { echo "❌ $1"; exit 1; }

json_field() {
  # usage: json_field '<json>' 'key'
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
print(cur if cur is not None else '')
PY
}

echo "🧪 MenRush pre-deployment feature checks"
echo "API: $API_URL"
echo "--------------------------------"

# 0. Health / reachability
HEALTH=$(curl -s -o /tmp/mr_health.body -w "%{http_code}" "$API_URL/../" || true)
# Express may 404 on /, so treat any HTTP response as reachability
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/auth/login" -X POST -H 'Content-Type: application/json' -d '{}' || echo "000")
if [ "$CODE" = "000" ]; then
  die "Backend not reachable at $API_URL"
fi
ok "Backend reachable (login probe HTTP $CODE)"

# 1. Beta invite validation (route is /beta/validate-invite, not /auth/...)
echo "🎟️  Validating beta invite..."
INVITE_RES=$(curl -s -X POST "$API_URL/beta/validate-invite" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$BETA_CODE\"}")
if echo "$INVITE_RES" | grep -q '"valid":true'; then
  ok "Beta invite accepted"
else
  die "Beta invite failed: $INVITE_RES"
fi

BAD_INVITE=$(curl -s -X POST "$API_URL/beta/validate-invite" \
  -H "Content-Type: application/json" \
  -d '{"code":"NOT-A-REAL-CODE"}')
if echo "$BAD_INVITE" | grep -qi 'error\|not recognized\|not open\|invalid\|expired'; then
  ok "Invalid beta invite rejected"
else
  bad "Invalid beta invite should fail: $BAD_INVITE"
fi

# 2. Register User 1 (Alice) — body field is invite_code
echo "👤 Registering Alice..."
SUFFIX=$(date +%s)
RES1=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"alice+$SUFFIX@test.com\",\"password\":\"password123\",\"name\":\"Alice\",\"age\":25,\"invite_code\":\"$BETA_CODE\"}")
TOKEN1=$(json_field "$RES1" "token")
USER1_ID=$(json_field "$RES1" "user.id")
[ -n "$TOKEN1" ] || die "Alice registration failed: $RES1"
ok "Alice registered ($USER1_ID)"

# 3. Register User 2 (Bob)
echo "👤 Registering Bob..."
RES2=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"bob+$SUFFIX@test.com\",\"password\":\"password123\",\"name\":\"Bob\",\"age\":28,\"invite_code\":\"$BETA_CODE\"}")
TOKEN2=$(json_field "$RES2" "token")
USER2_ID=$(json_field "$RES2" "user.id")
[ -n "$TOKEN2" ] || die "Bob registration failed: $RES2"
ok "Bob registered ($USER2_ID)"

# 4. Login
echo "🔐 Testing login..."
LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"alice+$SUFFIX@test.com\",\"password\":\"password123\"}")
LOGIN_TOKEN=$(json_field "$LOGIN" "token")
[ -n "$LOGIN_TOKEN" ] || die "Login failed: $LOGIN"
ok "Login works"

# 5. Locations
echo "📍 Updating locations..."
curl -s -X POST "$API_URL/users/location" -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" -d '{"lat":40.7128,"lng":-74.0060}' > /dev/null
curl -s -X POST "$API_URL/users/location" -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" -d '{"lat":40.7130,"lng":-74.0065}' > /dev/null
ok "Locations updated"

# 6. Profile photo upload
echo "🖼️  Testing profile photo upload..."
printf '\xff\xd8\xff\xd9' > /tmp/dummy.jpg
PHOTO_RES=$(curl -s -X POST "$API_URL/users/photo" \
  -H "Authorization: Bearer $TOKEN1" \
  -F "photo=@/tmp/dummy.jpg;type=image/jpeg")
rm -f /tmp/dummy.jpg
PHOTO_URL=$(json_field "$PHOTO_RES" "photo_url")
if [ -n "$PHOTO_URL" ]; then
  ok "Photo upload ($PHOTO_URL)"
else
  bad "Photo upload failed: $PHOTO_RES"
fi

# 7. Discovery / nearby
echo "🔍 Testing nearby discovery..."
NEARBY=$(curl -s -X GET "$API_URL/users/nearby?lat=40.7128&lng=-74.0060" \
  -H "Authorization: Bearer $TOKEN1")
if echo "$NEARBY" | grep -q "Bob"; then
  ok "Nearby discovery found Bob"
else
  bad "Nearby discovery missed Bob: $NEARBY"
fi

# Age filter empty
FILTER1=$(curl -s -X GET "$API_URL/users/nearby?lat=40.7128&lng=-74.0060&minAge=18&maxAge=20" \
  -H "Authorization: Bearer $TOKEN1")
if [ "$FILTER1" = "[]" ]; then
  ok "Age filter 18-20 empty"
else
  bad "Age filter 18-20 expected [] got: $FILTER1"
fi

# Age filter hit
FILTER2=$(curl -s -X GET "$API_URL/users/nearby?lat=40.7128&lng=-74.0060&minAge=25&maxAge=30" \
  -H "Authorization: Bearer $TOKEN1")
if echo "$FILTER2" | grep -q "Bob"; then
  ok "Age filter 25-30 found Bob"
else
  bad "Age filter 25-30 missed Bob: $FILTER2"
fi

# 8. Likes & matches
echo "❤️  Testing likes & matches..."
LIKE1=$(curl -s -X POST "$API_URL/users/like/$USER2_ID" -H "Authorization: Bearer $TOKEN1")
LIKE2=$(curl -s -X POST "$API_URL/users/like/$USER1_ID" -H "Authorization: Bearer $TOKEN2")
if echo "$LIKE2" | grep -q '"match":true'; then
  ok "Mutual like created a match"
else
  bad "Match failed: like1=$LIKE1 like2=$LIKE2"
fi

MATCHES=$(curl -s -X GET "$API_URL/users/matches" -H "Authorization: Bearer $TOKEN1")
if echo "$MATCHES" | grep -q "Bob"; then
  ok "Bob listed in Alice matches"
else
  bad "Matches list missing Bob: $MATCHES"
fi

# 9. Messaging
echo "💬 Testing messaging..."
MSG=$(curl -s -X POST "$API_URL/messages" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d "{\"receiver_id\":\"$USER2_ID\",\"message\":\"hey bob from alice\"}")
MSG_ID=$(json_field "$MSG" "id")
if [ -n "$MSG_ID" ]; then
  ok "Message sent ($MSG_ID)"
else
  bad "Send message failed: $MSG"
fi

CONV=$(curl -s -X GET "$API_URL/messages/conversation/$USER2_ID" \
  -H "Authorization: Bearer $TOKEN1")
if echo "$CONV" | grep -q "hey bob from alice"; then
  ok "Conversation history contains message"
else
  bad "Conversation missing message: $CONV"
fi

CONVS=$(curl -s -X GET "$API_URL/messages/conversations" \
  -H "Authorization: Bearer $TOKEN1")
if echo "$CONVS" | grep -q "Bob"; then
  ok "Conversations list includes Bob"
else
  bad "Conversations list missing Bob: $CONVS"
fi

# 10. Auth guard
echo "🔒 Testing auth guard..."
UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/users/matches")
if [ "$UNAUTH" = "401" ] || [ "$UNAUTH" = "403" ]; then
  ok "Unauthenticated matches request blocked ($UNAUTH)"
else
  bad "Expected 401/403 for unauth matches, got $UNAUTH"
fi

# 11. Verification contract — OPTIONAL while Codex owns ID verification.
# Frontend FEATURES.requireIdVerification is false; do not block deploy on this.
echo "🪪 Checking verification API (informational — not a deploy gate)..."
VERIFY_CODE=$(curl -s -o /tmp/mr_verify.body -w "%{http_code}" \
  "$API_URL/verify/status" -H "Authorization: Bearer $TOKEN1")
if [ "$VERIFY_CODE" = "404" ]; then
  ok "Verify endpoints absent/paused (Codex owns ID verification; gate is OFF)"
elif [ "$VERIFY_CODE" = "200" ] || [ "$VERIFY_CODE" = "401" ] || [ "$VERIFY_CODE" = "403" ]; then
  ok "Verify status endpoint present (HTTP $VERIFY_CODE) — available but not required"
else
  ok "Verify status HTTP $VERIFY_CODE (non-blocking; Codex owns this path)"
fi

HAS_VERIFIED=$(json_field "$LOGIN" "user.is_verified")
HAS_VSTATUS=$(json_field "$LOGIN" "user.verification_status")
if [ -n "$HAS_VERIFIED" ] || [ -n "$HAS_VSTATUS" ]; then
  ok "Login payload includes verification fields (optional trust tier)"
else
  ok "Login payload omits verification fields (fine while requireIdVerification=false)"
fi

# 12. Health endpoint
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL%/api}/health")
if [ "$HEALTH_CODE" = "200" ]; then
  ok "Health endpoint OK"
else
  bad "Health endpoint HTTP $HEALTH_CODE"
fi

echo "--------------------------------"
echo "Passed: $PASS  Failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "✨ PRE-DEPLOY CHECKS FAILED"
  exit 1
fi
echo "✨ ALL PRE-DEPLOY FEATURE TESTS PASSED"
exit 0
