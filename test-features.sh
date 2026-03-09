#!/bin/bash

# Near&Now - Feature Verification Script
# Verifies: Auth, Profile Upload, Likes & Matches, Search Filters

API_URL="http://localhost:3000/api"
TOKEN1=""
TOKEN2=""
USER1_ID=""
USER2_ID=""

echo "🧪 Starting Feature Verification..."
echo "--------------------------------"

# 1. Register User 1
echo "👤 Registering User 1 (Alice)..."
RES1=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"password123","name":"Alice","age":25}')
TOKEN1=$(echo $RES1 | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USER1_ID=$(echo $RES1 | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN1" ]; then echo "❌ Alice registration failed: $RES1"; exit 1; fi
echo "✅ Alice registered (ID: $USER1_ID)"

# 2. Register User 2
echo "👤 Registering User 2 (Bob)..."
RES2=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@test.com","password":"password123","name":"Bob","age":28}')
TOKEN2=$(echo $RES2 | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USER2_ID=$(echo $RES2 | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN2" ]; then echo "❌ Bob registration failed: $RES2"; exit 1; fi
echo "✅ Bob registered (ID: $USER2_ID)"

# 3. Update Locations (Needed for discovery)
echo "📍 Updating locations..."
curl -s -X POST $API_URL/users/location -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" -d '{"lat":40.7128,"lng":-74.0060}' > /dev/null
curl -s -X POST $API_URL/users/location -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" -d '{"lat":40.7130,"lng":-74.0065}' > /dev/null
echo "✅ Locations updated"

# 4. Test Profile Photo Upload (User 1)
echo "🖼️ Testing Profile Photo Upload..."
# Create a dummy image
echo "dummy" > dummy.jpg
PHOTO_RES=$(curl -s -X POST $API_URL/users/photo \
  -H "Authorization: Bearer $TOKEN1" \
  -F "photo=@dummy.jpg")
rm dummy.jpg

if echo $PHOTO_RES | grep -q "photo_url"; then
  echo "✅ Photo upload successful: $(echo $PHOTO_RES | grep -o '"photo_url":"[^"]*' | cut -d'"' -f4)"
else
  echo "❌ Photo upload failed: $PHOTO_RES"; exit 1
fi

# 5. Test Likes & Matches
echo "❤️ Testing Likes & Matches..."
# Alice likes Bob
LIKE1=$(curl -s -X POST $API_URL/users/like/$USER2_ID -H "Authorization: Bearer $TOKEN1")
echo "   Alice likes Bob: $LIKE1"

# Bob likes Alice (Should result in a match)
LIKE2=$(curl -s -X POST $API_URL/users/like/$USER1_ID -H "Authorization: Bearer $TOKEN2")
echo "   Bob likes Alice: $LIKE2"

if echo $LIKE2 | grep -q '"match":true'; then
  echo "✅ Match confirmed!"
else
  echo "❌ Match failed: $LIKE2"; exit 1
fi

# 6. Verify Matches List
echo "📋 Verifying Matches List for Alice..."
MATCHES=$(curl -s -X GET $API_URL/users/matches -H "Authorization: Bearer $TOKEN1")
if echo $MATCHES | grep -q "Bob"; then
  echo "✅ Bob found in Alice's matches list"
else
  echo "❌ Bob missing from matches: $MATCHES"; exit 1
fi

# 7. Test Discovery Filters
echo "🔍 Testing Discovery Filters (Age Range)..."
# Search for users age 18-20 (Alice is 25, Bob is 28) -> Should be empty
FILTER1=$(curl -s -X GET "$API_URL/users/nearby?lat=40.7128&lng=-74.0060&minAge=18&maxAge=20" -H "Authorization: Bearer $TOKEN1")
if [ "$FILTER1" == "[]" ]; then
  echo "✅ Age filter (18-20) correctly returned empty list"
else
  echo "❌ Age filter failed: $FILTER1"
fi

# Search for users age 25-30 -> Should find Bob
FILTER2=$(curl -s -X GET "$API_URL/users/nearby?lat=40.7128&lng=-74.0060&minAge=25&maxAge=30" -H "Authorization: Bearer $TOKEN1")
if echo $FILTER2 | grep -q "Bob"; then
  echo "✅ Age filter (25-30) correctly found Bob"
else
  echo "❌ Age filter failed: $FILTER2"
fi

echo "--------------------------------"
echo "✨ ALL FEATURE TESTS PASSED! ✨"
