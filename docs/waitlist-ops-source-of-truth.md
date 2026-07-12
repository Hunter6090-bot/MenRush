# MenRush Waitlist Ops Source Of Truth

This runbook exists to prevent duplicate welcome emails, stale imports, and old
legacy assumptions.

## Current Rules

1. Do not send or import from an old CSV unless it has been compared against the
   current Zoho export and the send ledger.
2. Treat Zoho Forms or Zoho Campaigns as the signup source of truth until the
   live `menrush.com` bundle is confirmed to post to the MenRush backend.
3. Treat `waitlist_drip_sends` as the backend send ledger only for addresses
   that were actually imported into the backend database.
4. Never assume a local CSV is current. Every bulk send starts from a fresh Zoho
   export.
5. Never use outdated local paths in MenRush operations.

## Before Any Email Send

Run these checks first:

```bash
curl -sS https://menrush.com | rg -n "assets/index"
curl -sS https://menrush.com/assets/<current-bundle>.js | rg -n "waitlist|zohopublic|backend-production|api.menrush"
```

Confirm where the live site sends signups:

- If the bundle only contains `forms.zohopublic.com`, current signups live in
  Zoho first.
- If the bundle contains `/api/waitlist` or the Railway backend URL, current
  signups should also be in the backend database.

Then check email automation status in Zoho:

- Zoho Forms: `MenRushcom` form entries.
- Zoho Campaigns: MenRush waitlist workflow/list.
- Confirm recent signups entered the workflow and received the welcome email.

Do not run `--send-now` until this is confirmed.

## Old Catch-Up Batch

The old local batch was a one-time catch-up for people who had signed up before
automation was working. Do not resend a welcome email to that batch without
explicit confirmation.

The old local database showed those records with campaign send history. That
does not prove production state; it only means do not blindly reuse the old CSV.

## Safe Import Pattern

Only after exporting the current Zoho list and filtering/confirming recipients:

```bash
cd /Users/alzain/em/backend
npm run waitlist:import -- --csv /Users/alzain/em/current-zoho-waitlist.csv --source zoho-forms --limit 500
```

Use `--send-now` only when the target set is confirmed to be people who have not
already received the welcome email:

```bash
npm run waitlist:import -- --csv /Users/alzain/em/current-zoho-waitlist.csv --source zoho-forms --send-now --limit 500
```

## Deployment Note

If the live bundle is still Zoho-only but the repo has backend dual-write logic,
redeploy the frontend before relying on the backend waitlist table for future
signups.

After redeploy, verify the live bundle again and run a test signup using an
address that is clearly marked as a test.
