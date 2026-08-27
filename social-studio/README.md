# MenRush Social Studio

Local-only operator app for **Connections** (platform keys) and **This week** (Oct 1 2026 campaign drafts + visual workspace).  
Keys stay on this device. Nothing here is deployed to Vercel or Railway.

> Connections is where the studio gets permission to post. Keys stay on this device. On means that platform is in the week. Verify checks the key before you approve.

## Run

```bash
cd social-studio
npm install
npm start
# or: npm run studio
```

Opens `http://127.0.0.1:3847`. Bound to localhost only.

```bash
SOCIAL_STUDIO_NO_OPEN=1 npm start   # skip browser open
SOCIAL_STUDIO_PORT=4000 npm start   # custom port
```

## Where keys / media live

| What | Where |
|---|---|
| Connection secrets | `social-studio/.data/connections.json` (mode `0600`, gitignored) |
| Draft prompts + image paths | `social-studio/.data/draft-media.json` + `.data/media/` (gitignored) |
| Optional image-gen key | `social-studio/.data/studio-settings.json` (gitignored) |
| Publish results | `social-studio/.data/publish-log.json` (gitignored) |

Enter keys only in the Connections UI. The studio does **not** load repo-root env files and does not import secrets from git history.

Never commit `social-studio/.data/`, `.env`, `.env.menrush-social`, or platform secrets. The studio never sends connection keys to MenRush production APIs.

Optional (drafts only — not keys):

```bash
export ADMIN_TOKEN=…              # read-only X-Admin-Token
export SOCIAL_API_URL=https://…   # MenRush API origin
```

If those are unset or unreachable, the studio loads the local pack from `src/drafts/oct1-2026.json` (sourced from `docs/social-oct1-2026.md` / campaign `oct1-2026`).

## Connections

| Platform | Fields | Verify (no post) |
|---|---|---|
| **X** | API Key, API Key Secret, Access Token, Access Token Secret | `account/verify_credentials` |
| **Instagram** | Access token, IG user id | Graph `GET` user |
| **Reddit** | Client id, Client secret, Username, Password, Subreddit (optional) | OAuth password grant + `/api/v1/me` |
| **Bluesky** | Handle, App password | `createSession` |
| **Threads** | Access token, Threads user id | Graph identity |

Plus optional **Image generate** (API key) — does not use Verify/On. Local poster Generate on This week works without it; **Generate (AI)** stays disabled until a key is saved.

Fill a card → **Verify** → leave **On** → open **This week** → **Approve & post**.

### X: Bearer Token cannot tweet

Use **OAuth 1.0a User Context** only (the four keys above).  
**Bearer Token / Application-Only** cannot post. Leave it out. Get keys at [developer.x.com](https://developer.x.com) → your app → Keys and tokens.

## This week (card review)

- **Card grid** (not a text feed): large picture, UK date/time/type, editable caption, platform hashtags, **Change front**.
- Sticky **Approve week**. Approve is still the only publish. No auto-publish.
- Week 1 is **21-27 Aug 2026**. Day 1 (21 Aug) defaults to the **Nearby. Verified. Now.** brand frame for preview only. Other days may show the medallion as a card placeholder until you upload.
- Change front opens a photo plate (brand frames for preview) or **upload your own** owner picture.
- **Instagram Approve** uses the draft’s owner-photo public `https://` URL (preferred: `https://menrush.com/images/ig/…`, or an already-live `https://menrush.com/images/…` library match). Local uploads are staged into `frontend/public/images/ig/` and, if that URL is not live yet, temporarily hosted so Graph can fetch immediately. You do **not** paste a URL. The medallion logo is **never** used as the post image. Drafts with no owner photo are **skipped**.
- Caption edits and custom images persist under `.data/` (gitignored).

Production `backend/src/routes/social.ts` stays record-only. This studio posts from your machine, not Railway.

## Smoke check (no keys)

```bash
cd social-studio
SOCIAL_STUDIO_NO_OPEN=1 npm start &
sleep 1
curl -s http://127.0.0.1:3847/api/health
curl -s http://127.0.0.1:3847/api/connections | head
curl -s http://127.0.0.1:3847/api/week | head
node scripts/test-owner-photo-https.mjs
```

`test-owner-photo-https.mjs` saves a tiny owner PNG into a draft, hosts it to public https, asserts the URL is fetchable, and asserts the logo is never accepted as a post image.
