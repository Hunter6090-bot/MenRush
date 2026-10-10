# 2FA (TOTP) wrap key: deploy, rotate, verify, roll back

The runbook for #398. Follow it in order. Nobody reads, prints or pastes a key: keys live in
Railway variables only, and the script prints counts only.

## What the script does

Run from `backend/` in a checkout of the merged code. `railway run` injects the backend
service variables into that one process only.

| Mode | Command flag | Writes? | Passes when |
| --- | --- | --- | --- |
| Dry run | (none) | No, read-only transaction | `result=OK`: every row decrypts with the current or previous key |
| Apply | `--apply --confirm-production` | Yes, one transaction, rows locked | every row re-encrypted to v2 under the current key and checked before commit; any unreadable row rolls the whole thing back |
| Verify | `--verify` | No | every row is in the write format (v2, or v1 while `TOTP_WRITE_FORMAT=v1`) and decrypts with `TOTP_ENCRYPTION_KEY` **alone** |
| Reverse | `--reverse --confirm-production` | Yes, one transaction, rows locked | code rollback only: every row rewritten as v1 under the current key, checked before commit |

Safety gate: `NODE_ENV` must be set for the run or the script refuses. A Railway database is
refused unless `NODE_ENV=production`. On production, `--apply` and `--reverse` refuse without
`--confirm-production`. **`--reverse` also refuses unless `TOTP_WRITE_FORMAT=v1` is set**, so the
running app cannot write v2 again behind it, and `--apply` refuses while `TOTP_WRITE_FORMAT=v1`
is set. Unknown flags are refused. Exit code is 0 only on `result=OK`.

Key check (#400): dry run, verify and apply also test the **current** key (`TOTP_ENCRYPTION_KEY`,
which is the new key during a rotation) with the same rule production checks at startup: at
least 32 random bytes written as hex or base64, not low-variety. A key that fails prints
`key_check=FAIL problem=<unset|not-encoded|too-short|low-variety>` (never the key), the run ends
`result=NOT OK` with exit code 1, and apply refuses before writing anything. Reverse is not
checked, because it prepares a code rollback to code without that rule.

```
railway link                     # once: project MenRush, environment production
cd backend && npm ci

# dry run
railway run --service backend -- env NODE_ENV=production npm run -s totp:rotate
# apply
railway run --service backend -- env NODE_ENV=production npm run -s totp:rotate -- --apply --confirm-production
# verify with the current key alone (previous key blanked for this run only)
railway run --service backend -- env NODE_ENV=production TOTP_ENCRYPTION_KEY_PREVIOUS= npm run -s totp:rotate -- --verify
# reverse (code rollback only, needs TOTP_WRITE_FORMAT=v1 set on the service first)
railway run --service backend -- env NODE_ENV=production npm run -s totp:rotate -- --reverse --confirm-production
```

If `DATABASE_URL` is a `*.railway.internal` host, override it for that run with the Postgres
public URL, or run inside the service.

"Today's key" below means the value the backend uses now: `TOTP_ENCRYPTION_KEY`, or
`JWT_SECRET` if `TOTP_ENCRYPTION_KEY` is unset. Check which in Railway; nobody has read it for
this PR.

## 1. Deploy

1. Merge #398 and let Railway and Vercel deploy, with today's variables unchanged.
2. Dry run. Continue only on `result=OK` and `unreadable=0`.
3. Nothing is rewritten yet, but **new 2FA setups from now on are stored as v2**, which the
   pre-#398 code cannot read. So from this point, going back to the old code needs the
   code rollback in section 5, even if no key was ever rotated.

## 2. Rotate (forward)

1. Generate the new key in a terminal with `openssl rand -base64 32` and put it straight into
   Railway. In **one** variables change, set:
   - `TOTP_ENCRYPTION_KEY` = the new key
   - `TOTP_ENCRYPTION_KEY_PREVIOUS` = today's key

   Wait for the redeploy. Both keys decrypt, so nobody is locked out. Successful logins
   re-encrypt their own row to v2 under the new key as they happen.
2. Dry run. Continue only on `result=OK`.
3. Apply: `--apply --confirm-production`. Continue only on `result=OK`.

## 3. Verify

1. Verify with the previous key blanked for that run (command above). Continue only on
   `result=OK` and `unreadable=0`.
2. Only then remove `TOTP_ENCRYPTION_KEY_PREVIOUS` from Railway. Keep today's key in the
   password manager until you are sure you will not need the key rollback.
3. (#400, if merging it) only after this step, and only with a key that meets its rule.

**Never remove the previous key before `--verify` is clean.**

## 4. Key rollback (back to the old key, same code)

Use this if the new key has to go. The code stays as it is.

1. In **one** variables change, set `TOTP_ENCRYPTION_KEY` = the old key and
   `TOTP_ENCRYPTION_KEY_PREVIOUS` = the new key. Wait for the redeploy. Both keys decrypt, so
   nobody is locked out at any point.
2. Dry run, then `--apply --confirm-production`. Continue only on `result=OK`.
3. Verify with the previous key blanked. Continue only on `result=OK`.
4. Only then remove `TOTP_ENCRYPTION_KEY_PREVIOUS`.

This is **not** `--reverse`. The rows stay v2, now under the old key.

## 5. Code rollback (revert #398)

Do this in order. Reverting the code first would lock out every member with a v2 row.

1. If #400 is merged, revert it first (its guard is its only behaviour change).
2. Keep `TOTP_ENCRYPTION_KEY` as it is (the reverted code will use it, hashed, for v1). Set
   `TOTP_WRITE_FORMAT=v1` on the backend service. Wait for the redeploy. From now on every
   write (new setups and lazy re-encrypts) is v1.
3. Dry run. Continue only on `result=OK`.
4. Reverse: `--reverse --confirm-production`. It refuses if `TOTP_WRITE_FORMAT=v1` is not set.
   Continue only on `result=OK`.
5. Verify (it checks v1 under the current key alone). Continue only on `result=OK`.
6. Revert the code (a normal revert PR, merged by Al) and let it deploy. Keep
   `TOTP_ENCRYPTION_KEY` unchanged.
7. After the revert is live, remove `TOTP_WRITE_FORMAT` and any `TOTP_ENCRYPTION_KEY_PREVIOUS`.
   The old code ignores both.

**Never revert the code before step 5 is `result=OK`.**

## Abandoned setups

Accounts with a stored secret but no confirmed 2FA are counted as `pending` and handled like
every other row. Any cleanup is the owner's decision, handled privately.
