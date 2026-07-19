# Waitlist update — "Beta 200" send instructions

One-off campaign. Not part of the drip series.

## Files

- `waitlist-update-beta200.html` — branded HTML email, matches the visual system from `welcome-email.html`
- `waitlist-update-beta200.txt` — plain-text fallback
- `../waitlist-recipients.csv` — deduped recipient list (14 emails, all from the single Zoho Forms source of truth; 3 test/probe addresses and duplicates removed; Adam Attrell excluded as co-director rather than waitlist prospect)

## Subject lines (pick one)

Primary recommendation:

> **MenRush update: Beta 200 is next**

Alternatives if you want to A/B:

- `Quick update from Al — plus your shot at a free year of Premium`
- `Thank you for waiting. Here's what's next.`
- `Beta 200: your odds are good`

## Preheader (preview text)

> Thank you for waiting. Beta 200. One full year of Premium for honest feedback.

## Sender

- **From:** `MenRush <hello@menrush.com>`
- **Reply-to:** `hello@menrush.com`

## Send via Resend (dashboard route)

1. In Resend, **verify the menrush.com domain** if you haven't already (SPF, DKIM, DMARC records on the menrush.com DNS). Without this, deliverability tanks.
2. Create a **Broadcast** (or "Campaign" — Resend's UI wording).
3. **Upload** `waitlist-recipients.csv` as an audience, or paste the addresses into a new audience called something like `waitlist-2026-q2`.
4. Set the **From**, **Reply-to**, **Subject**, and **Preheader** as above.
5. Paste the contents of `waitlist-update-beta200.html` into the HTML body.
6. Paste the contents of `waitlist-update-beta200.txt` into the plain-text body.
7. The placeholder `{{{RESEND_UNSUBSCRIBE_URL}}}` in both files is Resend's automatic unsubscribe-link variable. Resend should substitute it on send. If your Resend account uses a different variable name, swap it before sending.
8. **Send yourself a preview first.** Check rendering in:
   - Gmail web
   - Gmail iOS app
   - Apple Mail iOS
   - Outlook (if you have it) — Outlook is the most likely place for the layout to break
9. Once preview looks good, **trigger the send**.

## Two decisions before you hit send

1. **Test first.** Send the preview to `al.zain9690@gmail.com`, confirm rendering, then send to the remaining 13 waitlist recipients.
2. **Timing relative to the landing page change.** The live Coming Soon page now mentions Beta 200, so recipients who click through should see matching messaging on menrush.com.

## Social links

The HTML email now uses text links instead of social icon images. This is more reliable in email clients and avoids broken or squashed icon rendering.

The icons link to the confirmed MenRush handles:

- Instagram → https://instagram.com/menrushsocial
- X → https://x.com/menrushsocial
- TikTok → https://tiktok.com/@menrushsocial
- Reddit → https://reddit.com/user/MenRush
- Bluesky → https://bsky.app/profile/menrush.bsky.social

## After the send

Capture in your records:
- Total sent
- Bounces (any address that hard-bounces should be marked `bounced` in the backend `waitlist` table — see `docs/waitlist-ops-source-of-truth.md`)
- Unsubscribes
- Open rate + click rate (Resend dashboard will show these)
