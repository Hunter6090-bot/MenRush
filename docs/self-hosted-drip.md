# Self-hosted waitlist drip — MenRush

A backend-driven alternative to wiring up Zoho Campaigns (see
`docs/zoho-drip-setup.md` for that path). Reuses the same Zoho **Mail** SMTP
transport already verified end-to-end on 2026-05-12.

You can run this **instead of** or **alongside** Zoho Campaigns — but if you
run both, make sure each subscriber lives in only one system (otherwise they
get every email twice).

---

## What it does

| | |
|---|---|
| Trigger | Any insert into the `waitlist` table (via `POST /api/waitlist`). |
| Storage | `waitlist` (subscribers) + `waitlist_drip_sends` (send ledger). |
| Sending | Reuses the cached Zoho SMTP transport in `backend/src/services/mailer.service.ts`. |
| Schedule | 9 emails over ~75 days. Defined in `DRIP_SCHEDULE` in `backend/src/services/drip.service.ts`. |
| Worker | Either an external cron hitting `POST /api/waitlist/admin/run`, or an in-process timer enabled by `DRIP_WORKER_ENABLED=true`. |
| Idempotency | `UNIQUE (subscriber_id, template_key)` on the sends ledger — no duplicates even if two workers race. |
| Compliance | Every email gets `List-Unsubscribe` + `List-Unsubscribe-Post` headers and a footer unsubscribe link. Tokens are per-subscriber (`waitlist.unsubscribe_token`). |

---

## Files added by this feature

```
backend/src/services/mailer.service.ts     # Shared cached Zoho SMTP transport
backend/src/services/drip.service.ts       # Schedule, queries, worker
backend/src/routes/drip.ts                 # Unsubscribe + admin endpoints
database/migrations/007_waitlist_drip.sql  # Schema changes
docs/self-hosted-drip.md                   # This file
docs/zoho-drip-setup.md                    # Alternative Zoho Campaigns guide
```

Plus minor edits in `backend/src/server.ts` (mount routes + optional worker)
and `backend/src/services/contact-email.service.ts` (reuse shared mailer).

---

## Step 1 — Apply the schema migration

On any database that already ran `001_waitlist.sql`:

```bash
psql "$DATABASE_URL" -f database/migrations/007_waitlist_drip.sql
```

Fresh databases get everything from `database/schema.sql` automatically. The
migration is idempotent (`ALTER TABLE … IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

---

## Step 2 — Configure env vars

Add to your backend `.env` (and to the deployed environment — Railway/Render):

```bash
# Required for outgoing mail (you already have these from the contact form).
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=587
ZOHO_SMTP_SECURE=false
ZOHO_SMTP_USER=hello@menrush.com
ZOHO_SMTP_PASS=<zoho-app-password>
MAIL_FROM_EMAIL=hello@menrush.com   # optional, defaults to ZOHO_SMTP_USER

# Public origin used in unsubscribe links. Must be the BACKEND's public URL,
# not the frontend — links resolve to /api/waitlist/unsubscribe?token=...
PUBLIC_API_URL=https://api.menrush.com

# Required to call admin endpoints. Generate with: openssl rand -hex 32
DRIP_ADMIN_TOKEN=<long-random-string>

# Pick ONE worker model (see Step 4):
DRIP_WORKER_ENABLED=false
DRIP_WORKER_INTERVAL_MINUTES=60
```

---

## Step 3 — Get signups into the `waitlist` table

The drip only fires for rows in `waitlist`. Today, the live menrush.com
landing page POSTs directly to **Zoho Forms** (`forms.zohopublic.com/...`),
so nothing lands in our DB.

You have three options:

### Option A — Move signups to the backend (recommended long-term)
Change the landing form to POST to `https://api.menrush.com/api/waitlist`
instead of (or in addition to) the Zoho Forms endpoint. Diff lives in
`frontend/src/pages/ComingSoon.tsx` (on `origin/main`) — swap `ZOHO_SUBMIT_URL`
for the backend URL and adjust the body to `{ "email": "<value>" }`.

This drops the Zoho Forms dependency entirely.

### Option B — Dual-write
Keep Zoho Forms for backup, but ALSO `fetch()` `/api/waitlist` from the
landing page. Both records get created; both unsubscribes work
independently. Simple but duplicates the source-of-truth.

### Option C — One-time CSV import
For existing waitlist contacts already in Zoho Forms:

```bash
# 1. Export from Zoho Forms → All Entries → CSV.
# 2. Import via psql (assumes column "Email"):
psql "$DATABASE_URL" -c "\\copy waitlist (email) FROM 'waitlist.csv' WITH (FORMAT csv, HEADER true)"
# 3. Backfill unsubscribe tokens for the imported rows:
psql "$DATABASE_URL" <<SQL
UPDATE waitlist
   SET unsubscribe_token = encode(gen_random_bytes(24), 'base64')
 WHERE unsubscribe_token IS NULL;
SQL
```

After import, the next worker batch will send the welcome email to anyone
whose `created_at` is recent enough that the welcome (day 0) is the next
unsent step. Older imports get jumped straight to the appropriate step.

---

## Step 4 — Run a worker

Pick exactly one of these:

### Worker A — External cron (recommended for production)

Have any scheduler hit the admin endpoint every 15–60 minutes:

```bash
curl -X POST \
  -H "X-Drip-Admin-Token: $DRIP_ADMIN_TOKEN" \
  "https://api.menrush.com/api/waitlist/admin/run?limit=50"
```

Examples:

- **Railway**: dashboard → service → Settings → "Cron Schedule" — though
  Railway runs the cron in a fresh process, so use a separate one-shot service
  or a GitHub Action instead.
- **Render**: dashboard → New → "Cron Job" → command `curl -fSs -X POST -H "X-Drip-Admin-Token: $DRIP_ADMIN_TOKEN" "$BACKEND_URL/api/waitlist/admin/run"`.
- **GitHub Actions**: a `schedule: cron: '*/30 * * * *'` workflow that runs the same curl.
- **A separate VM**: standard crontab entry — `*/30 * * * * curl -fSs ...`.

Leave `DRIP_WORKER_ENABLED=false` when using external cron.

### Worker B — In-process (simplest for single-instance deploys)

In `.env`:
```
DRIP_WORKER_ENABLED=true
DRIP_WORKER_INTERVAL_MINUTES=60
```

The backend runs `runDripBatch(50)` every hour on its own. Fine for a
single-instance Railway/Render deployment. Do **not** use this when you have
multiple backend replicas — they'll all try to send simultaneously (the
unique constraint prevents duplicates but you'll waste SMTP connections).

---

## Step 5 — Verify

```bash
# 1. Insert a test signup.
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"al+drip@menrush.com","source":"smoke-test"}' \
  http://localhost:3000/api/waitlist

# 2. Check stats.
curl -H "X-Drip-Admin-Token: $DRIP_ADMIN_TOKEN" \
  http://localhost:3000/api/waitlist/admin/stats
# → { "subscribers": { "active": 1, ... }, "due_now": 1, ... }

# 3. Trigger a batch manually.
curl -X POST -H "X-Drip-Admin-Token: $DRIP_ADMIN_TOKEN" \
  "http://localhost:3000/api/waitlist/admin/run?limit=10"
# → { "attempted": 1, "sent": 1, "skipped": 0, "errors": [] }

# 4. Check that mr-d00-welcome was recorded.
psql "$DATABASE_URL" -c "SELECT email, template_key, sent_at FROM waitlist w
                         JOIN waitlist_drip_sends s ON s.subscriber_id = w.id
                         ORDER BY s.sent_at DESC LIMIT 5;"

# 5. Click the Unsubscribe link in the test email — confirm waitlist.status
#    flips to 'unsubscribed' and no further emails are scheduled.
```

---

## How the scheduling works

A subscriber's step N is due when:

```
NOW() >= subscriber.created_at + (DRIP_SCHEDULE[N].dayOffset * 1 day)
AND step N is not already in waitlist_drip_sends.
```

So:
- A signup from 30 days ago lands in `runDripBatch` with all steps up to day 25
  due simultaneously. They will receive them on consecutive batches (one per
  worker tick), not all at once — `limit` caps how many sends per batch.
- A signup from today only has day 0 due → only the welcome is sent.
- Day 75 is the last step. After that the subscriber stays in `active` status
  but no more emails go out unless you add new steps.

The `dayOffset`s in `DRIP_SCHEDULE` are **stable identifiers** indirectly —
the actual stability key is `step.key` (e.g. `mr-d05-first-look`). Renaming
a step's `key` will cause subscribers to re-receive that step. Reordering
offsets without renaming keys is safe.

---

## Domain authentication

Even with a working SMTP, Gmail will route these to spam unless `menrush.com`
has aligned SPF + DKIM + DMARC. Zoho's instructions are at:
https://www.zoho.com/mail/help/adminconsole/email-authentication.html

Minimum DNS:
```
menrush.com.            TXT  "v=spf1 include:zoho.com ~all"
zoho._domainkey.menrush.com. TXT  "<DKIM record Zoho gives you>"
_dmarc.menrush.com.     TXT  "v=DMARC1; p=none; rua=mailto:al@menrush.com"
```

Same DNS records work whether you send drip via Zoho Campaigns or this
self-hosted path — both go through Zoho Mail in the end.

---

## Operational notes

- **Templates are cached** in process memory after first read. Edits to
  `email-assets/*.html` require a backend restart (or call `templateCache.clear()`
  via a future admin endpoint).
- **Mailer transport is pooled** (3 connections, 100 messages per connection).
  A worker with `limit=50` runs comfortably in <30s.
- **Errors are non-fatal**: a failed send rolls back the ledger row so the
  next batch retries. After 3+ retries it might be worth flipping the
  subscriber to `status='bounced'` manually.
- **No bounce processing** is wired up — if Zoho returns a hard bounce, we
  won't catch it. For MVP that's acceptable; for scale, add a
  `/webhook/zoho/bounce` endpoint and update `status='bounced'`.
- **No open/click tracking**. Adding it requires a pixel + redirect endpoint —
  out of scope for MVP.

---

## Pulling the plug

Disable the worker without dropping data:

```bash
# External cron path: simply stop the scheduler.
# In-process path:
echo "DRIP_WORKER_ENABLED=false" >> backend/.env
# Then restart the backend.
```

Subscribers, sends ledger, and unsubscribe tokens remain in the database.
Re-enable any time without re-sending anything (the unique constraint keeps
the ledger honest).
