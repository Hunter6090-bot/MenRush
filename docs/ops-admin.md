# Ops admin API

All routes require header:

```http
x-admin-token: <ADMIN_TOKEN>
```

Base: `https://backend-production-d587.up.railway.app/api/admin`  
(or staging equivalent)

## Media health

```bash
curl -s "$API/admin/media/health" -H "x-admin-token: $ADMIN_TOKEN"
```

Expect `{ "ok": true, "root": "/app/uploads", "storage": "disk" }`.

## Verify a user

```bash
curl -s -X POST "$API/admin/users/verify" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"email":"user@example.com","verified":true}'
```

## Create matched call-test pair

```bash
curl -s -X POST "$API/admin/users/test-pair" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"password":"test1234"}'
```

Returns two emails + shared password, mutual likes, nearby coords.

## Delete test user

Only `@menrush.test` or `@example.com`:

```bash
curl -s -X DELETE "$API/admin/users/test/iphone-call%40menrush.test" \
  -H "x-admin-token: $ADMIN_TOKEN"
```

## Invite codes

```bash
curl -s -X POST "$API/admin/invite-codes/generate" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"count":5,"max_uses":1,"note":"beta"}'
```

## Object storage (optional S3 / R2)

Default media is the Railway volume at `/app/uploads` (`storage: "disk"`).

To dual-write new uploads to S3-compatible storage (Cloudflare R2 recommended):

| Env | Purpose |
|-----|---------|
| `S3_BUCKET` | Bucket name |
| `S3_ACCESS_KEY_ID` | Key |
| `S3_SECRET_ACCESS_KEY` | Secret |
| `S3_ENDPOINT` | R2 endpoint URL |
| `S3_PUBLIC_BASE_URL` | Public CDN/base URL for photo_url |
| `S3_DELETE_LOCAL` | `true` to drop local file after upload |
| `S3_REGION` | Optional; default `auto` |

Install SDK on the backend when enabling: `npm i @aws-sdk/client-s3`.

## Call metrics

WebRTC events log as single-line JSON:

```text
[call-metrics] {"ts":"…","component":"webrtc","event":"call_initiate",…}
```

Events: `call_initiate`, `call_offline`, `call_incoming_emitted`, `call_answer`, `call_reject`, `call_end`, `call_error`.
