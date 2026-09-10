# Email confirm + welcome — BOA90 / Al lock

Al lock (8 Sep 2026): **first live confirm-email and welcome sends go to Al only** before the gate opens broadly.

## Owner path (required before Product merge)

1. Deploy this branch to an environment Al can hit (BOA90).
2. Keep `EMAIL_CONFIRM_MAIL_OPEN` unset or `false` (default).
3. Register / confirm as **`al@menrush.com`** (or display name **BOA90**).
4. Confirm both mails arrive in Al’s inbox (transactional Resend → Zoho only — **no blast**):
   - Subject: `Confirm your MenRush email`
   - Subject: `You are in. Welcome to MenRush`
5. Al Approves on BOA90.
6. Only then set `EMAIL_CONFIRM_MAIL_OPEN=true` on Railway and let Product merge / open the gate for everyone.

## Flag

| Env | Default | Effect |
| --- | --- | --- |
| `EMAIL_CONFIRM_MAIL_OPEN` | `false` | Confirm + welcome **mails** only to `al@menrush.com` or display name `BOA90` |
| `EMAIL_CONFIRM_MAIL_OPEN=true` | — | Gate + mails for all new signups |

While locked, other signups keep a **legacy live session** (no confirm/welcome mail) so the beta is not stranded. No Resend campaign / drip / mass-send is used for these mails — `sendTransactionalEmail` only.

## Brand copy

Unchanged. Welcome still omits rooms, temp profile, albums, Cruise.

## Migration

`051_email_confirm.sql` (renumbered off `048` so Cruise Hot Spots `#217` keeps `048`–`050`).
