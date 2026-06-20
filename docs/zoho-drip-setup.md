# Zoho Campaigns drip setup — MenRush waitlist

Before exporting, importing, or sending to the waitlist, read
[`docs/waitlist-ops-source-of-truth.md`](waitlist-ops-source-of-truth.md).
That runbook defines the current source-of-truth checks and duplicate-send
guardrails.

**Goal:** new waitlist signups on menrush.com automatically start receiving the
welcome + drip series of emails currently sitting in `email-assets/`.

**Time to run:** ~30 minutes in the Zoho dashboards (Forms + Campaigns).

**Prerequisite:** Zoho Mail SMTP for `hello@menrush.com` is already working —
verified end-to-end on 2026-05-12 with `backend/scripts/test-zoho.ts --send`
(message accepted by `mx.zohomail.com`, delivered to `privacy@menrush.com`).

---

## Step 1 — Decide which Zoho service hosts the drip

You already use two Zoho services:

| Service | Role today | What it's good for |
|---|---|---|
| **Zoho Forms** (`forms.zohopublic.com/hellomen1/form/MenRushcom/...`) | Captures waitlist signups | Form-only. The "auto-reply" it offers is a single email, not a drip series. |
| **Zoho Campaigns** | Not yet set up | Mailing lists, workflow-based drip / autoresponder series. **This is what you need.** |

Sign in to **Zoho Campaigns** (https://campaigns.zoho.com/) with the same
account that owns the `hellomen1` Zoho Forms form.

---

## Step 2 — Create the mailing list

1. Campaigns → **Contacts → Mailing Lists → Create List**.
2. Name: `MenRush Waitlist`.
3. Description: `Pre-launch waitlist from menrush.com landing page form.`
4. From name: `MenRush`.
5. From email: `hello@menrush.com` (must match `ZOHO_SMTP_USER` in
   `backend/.env`).
6. Reply-to: `hello@menrush.com`.
7. Subscription type: **Double opt-in: off** (Zoho Forms already collects
   explicit waitlist consent — a second confirmation email kills conversion).
   If you want belt-and-braces, leave it on, but expect ~30% drop-off.
8. Save the list. Note the **list ID** in the URL (you'll need it in Step 3).

---

## Step 3 — Wire Zoho Forms → Zoho Campaigns

1. Open the `MenRushcom` form at https://forms.zoho.com/.
2. Top bar → **Integrations** → **Zoho Campaigns**.
3. Connect → authorise (same Zoho account).
4. **Action: Add subscriber to a Mailing List**.
5. Pick `MenRush Waitlist` (created in Step 2).
6. Field mapping:
   - Form field `Email` → Campaigns field `Contact Email` (required)
   - Any other form fields you collect (name, age, city…) → matching Campaigns
     fields. Create custom fields in Campaigns first if you don't already have
     them (Contacts → Custom Fields).
7. **Trigger:** "On form submission".
8. Save. Submit a test entry through https://menrush.com to confirm the new
   subscriber appears in the `MenRush Waitlist` list within ~30 seconds.

---

## Step 4 — Upload the 10 templates as Campaigns emails

For each HTML file in `email-assets/`, do this once:

1. Campaigns → **Campaigns → Email Campaigns → Create Campaign**.
2. Type: **Regular email**.
3. Name (internal — not visible to recipients) → use the filenames below.
4. Subject line → use the titles below.
5. Sender details → from `MenRush <hello@menrush.com>`, reply-to `hello@menrush.com`.
6. Content → **HTML editor → Import from file** → upload the matching
   `email-assets/*.html`.
7. Click **Save as Template** (top right). The template is what the workflow
   will reuse — do **not** schedule a one-off send for these.
8. Repeat for all 10. After upload they all live under
   Campaigns → **Library → Templates**.

### Template list (in send order)

| # | File | Internal name | Subject |
|---|---|---|---|
| 0 | `welcome-email.html` | `mr-d00-welcome` | You're in. 30 days of Premium on us. |
| 1 | `email2-why-building.html` | `mr-d02-why-building` | Why I'm actually building MenRush |
| 2 | `email3-first-look.html` | `mr-d05-first-look` | First look 👀 |
| 3 | `email4-first-100.html` | `mr-d10-first-100` | You might be in the first 100 |
| 4 | `email5-save-the-date.html` | `mr-d17-save-the-date` | Save the date — beta opens September 10, 2026 |
| 5 | `drip-2-build-journey.html` | `mr-d25-build-journey` | 5 weeks of building MenRush. Here's what I've broken so far. |
| 6 | `drip-3-map-view.html` | `mr-d40-map-view` | The map view (this is the part that's different) |
| 7 | `drip-4-founding-members.html` | `mr-d55-founding-members` | Three weeks before we open, 100 men get in early |
| 8 | `drip-5-invitations-land.html` | `mr-d75-invitations-land` | One last note before we go quieter |

Note: `welcome.html` is an older alternate of `welcome-email.html` and is **not**
in this schedule. Decide which one you prefer and use only that.

---

## Step 5 — Build the workflow (the drip)

1. Campaigns → **Workflows → Create Workflow**.
2. Name: `Waitlist drip — menrush.com`.
3. Mailing List: `MenRush Waitlist`.
4. **Trigger:** `Joined the list`.
5. Add steps using the canvas — each `Send email` step points at the template
   from Step 4, with a delay before it:

```
[Trigger: Joined list]
        ↓
   send: mr-d00-welcome               (delay 0 — send immediately)
        ↓
   wait 2 days
        ↓
   send: mr-d02-why-building
        ↓
   wait 3 days
        ↓
   send: mr-d05-first-look
        ↓
   wait 5 days
        ↓
   send: mr-d10-first-100
        ↓
   wait 7 days
        ↓
   send: mr-d17-save-the-date
        ↓
   wait 8 days
        ↓
   send: mr-d25-build-journey
        ↓
   wait 15 days
        ↓
   send: mr-d40-map-view
        ↓
   wait 15 days
        ↓
   send: mr-d55-founding-members
        ↓
   wait 20 days
        ↓
   send: mr-d75-invitations-land
        ↓
   [End]
```

Total span: 75 days. Launch is October 1, 2026 — anyone who signs up after
**~mid-July 2026** will be mid-series at launch and that's fine; they'll keep
receiving emails through their first weeks as a member.

6. Save → **Activate the workflow**.

---

## Step 6 — Backfill anyone already on the waitlist

If you have existing waitlist submissions in Zoho Forms that pre-date this setup:

1. Zoho Forms → form → **All Entries** → export to CSV.
2. Zoho Campaigns → `MenRush Waitlist` → **Add Contacts → Import** → upload the
   CSV.
3. **Important:** when Campaigns asks "add to active workflows?" — choose
   `Add to "Waitlist drip — menrush.com" starting from step 1`. This makes
   them receive the welcome email today, then the rest at the normal cadence.

---

## Step 7 — Smoke test

1. Open https://campaigns.zoho.com/ → Workflows → `Waitlist drip — menrush.com`.
2. Top right → **Test Workflow**.
3. Enter your own email (e.g. `al+drip@menrush.com`).
4. Confirm the welcome email arrives in <5 minutes.
5. Skip steps in the test runner to verify each template renders.
6. After verification, remove your test email from the live list to avoid
   getting the real send.

---

## Step 8 — Domain authentication (avoid the spam folder)

Before turning on real sends, make sure Zoho can send `From: hello@menrush.com`
**aligned** with SPF + DKIM + DMARC:

1. Zoho Campaigns → **Settings → Email Authentication → Add Domain**.
2. Add `menrush.com`.
3. Zoho gives you 3 DNS records to add:
   - **SPF**: `v=spf1 include:zoho.com ~all` (TXT at root)
   - **DKIM**: `zoho._domainkey.menrush.com` TXT record they generate
   - **DMARC**: `_dmarc.menrush.com` TXT — start with
     `v=DMARC1; p=none; rua=mailto:al@menrush.com`
4. Add the records at your DNS provider (probably Vercel or your registrar).
5. Back in Zoho → click **Verify**. Wait up to 60 minutes for propagation.

Without this, drip emails will land in Gmail's Promotions tab at best,
spam folder at worst.

---

## Verification checklist

- [ ] `MenRush Waitlist` mailing list exists in Zoho Campaigns
- [ ] Zoho Forms `MenRushcom` is integrated and pushes to that list
- [ ] All 9 templates uploaded under Campaigns → Library → Templates
- [ ] `Waitlist drip — menrush.com` workflow is **Active**
- [ ] SPF, DKIM, DMARC records verified for `menrush.com`
- [ ] Test signup at https://menrush.com triggers the welcome email
- [ ] Existing waitlist contacts imported and slotted into the workflow

---

## Fallback / replacement path

If Zoho Campaigns turns out to be slow, expensive at scale, or annoying to
manage, this repo also has a self-hosted drip sender at
`backend/src/services/drip.service.ts` (see `docs/self-hosted-drip.md`) that
uses the same Zoho **SMTP** transport we just verified. You can run either
or both — they don't conflict, but make sure only one sends each email to
avoid duplicates.
