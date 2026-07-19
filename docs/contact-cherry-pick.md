# Cherry-picking the contact form onto `main`

Goal: get the `/contact` page and `/api/contact` route from `mvp-complete`
onto `main` (the branch that builds menrush.com on Vercel) **without** dragging
in the rest of the MVP changes (Pulse, Stripe Identity, media messages, video
calling, etc.).

This document is the operating playbook — nothing here has been executed yet.

---

## Prerequisite: don't merge until the backend is reachable

The frontend Contact page POSTs to `${VITE_API_URL}/contact`. If you merge
this to `main` and Vercel rebuilds before the backend is deployed somewhere
with `ZOHO_SMTP_*` env vars set, every submission returns a network error
(`VITE_API_URL` either resolves to `http://localhost:3000/api` or is missing
entirely on Vercel).

**Order of operations:**

1. Deploy the backend (see `docs/railway-deploy.md`) → confirm
   `https://<api>.railway.app/health` returns 200 and the SMTP smoke test
   passes against that env.
2. Set `VITE_API_URL=https://<api>.railway.app/api` on Vercel
   (Project → Settings → Environment Variables → Production).
3. Then — and only then — open this contact-form PR.

---

## The 4 commits on `mvp-complete` that touch contact

| SHA | Message | Notes |
|---|---|---|
| `eb1840b` | chore: sync env examples and backend dependencies | Adds `nodemailer` + Zoho env vars **plus** Vite vars, video flags, TURN. Only the SMTP additions belong in the PR. |
| `baa8ac9` | feat(backend): server wiring and validation updates | Adds `ContactFormSchema` to `validation.ts` **plus** mounts contact route in `server.ts`. Clean enough to take. |
| `7d732e7` | feat(backend): add contact route and email service | Pure contact — 2 new files. **Clean cherry-pick.** |
| `eb1915f` | feat(frontend): contact flow, footer, and page updates | Contact page + footer **plus** unrelated tweaks to Discover, Login, Register, Privacy, Terms, ComingSoon, Layout. Don't cherry-pick; copy specific files instead. |

Plain `git cherry-pick` of all four would bring in ~20 files unrelated to
contact (Pulse hooks, video feature flags, layout changes, etc.). Easier to
**construct the branch by hand** — outlined below.

---

## Recipe

Run from the repo root, on a clean working tree.

```bash
# 0. Start from a fresh branch off main.
git fetch origin
git switch -c contact-form-only origin/main
```

### Step 1 — backend dependency (nodemailer)

```bash
cd backend
npm install --save nodemailer
npm install --save-dev @types/nodemailer
cd ..
```

This updates `backend/package.json` + `backend/package-lock.json`. Don't
hand-edit — let npm pick the latest patch version.

### Step 2 — copy the standalone backend files from `mvp-complete`

```bash
# Pull the original standalone versions from commit 7d732e7, NOT the
# refactored versions on the tip of mvp-complete (which now depend on
# mailer.service.ts that doesn't belong in this PR).
git show 7d732e7:backend/src/routes/contact.ts \
  > backend/src/routes/contact.ts
git show 7d732e7:backend/src/services/contact-email.service.ts \
  > backend/src/services/contact-email.service.ts
```

### Step 3 — add the Zod schema to `validation.ts`

Open `backend/src/types/validation.ts` and append:

```ts
export const ContactFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  enquiryType: z.enum(['general', 'privacy', 'support', 'press']),
  message: z.string().trim().min(10).max(5000),
});
export type ContactFormInput = z.infer<typeof ContactFormSchema>;
```

(Lifted from `baa8ac9` — verify it matches `git show baa8ac9 -- backend/src/types/validation.ts`.)

### Step 4 — mount the route in `server.ts`

Add the import alongside the others:

```ts
import contactRoutes from './routes/contact';
```

Add the mount after the existing `app.use('/api/...', ...)` calls:

```ts
app.use('/api/contact', contactRoutes);
```

### Step 5 — extend `backend/.env.example`

Append the Zoho block:

```
# ─── Zoho Mail SMTP (contact form → privacy@menrush.com) ─────────────────────
# Create an app-specific password in Zoho Mail → Security → App passwords.
# https://www.zoho.com/mail/help/zoho-smtp.html
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=587
ZOHO_SMTP_SECURE=false
ZOHO_SMTP_USER=notifications@menrush.com
ZOHO_SMTP_PASS=
CONTACT_TO_EMAIL=privacy@menrush.com
CONTACT_FROM_EMAIL=
```

### Step 6 — copy the frontend files

```bash
# Contact page itself.
git show eb1915f:frontend/src/pages/Contact.tsx \
  > frontend/src/pages/Contact.tsx

# Site footer.
git show eb1915f:frontend/src/components/SiteFooter.tsx \
  > frontend/src/components/SiteFooter.tsx
```

### Step 7 — extend the frontend API client

Open `frontend/src/api/client.ts` and append (near the other `*API` exports):

```ts
export interface ContactPayload {
  name: string;
  email: string;
  enquiryType: 'general' | 'privacy' | 'support' | 'press';
  message: string;
}

export const contactAPI = {
  submit: (data: ContactPayload) =>
    apiClient.post<{ success: true; message: string }>('/contact', data),
};
```

### Step 8 — add the route in `App.tsx`

In `frontend/src/App.tsx`, alongside existing routes:

```ts
import { Contact } from './pages/Contact';
// …inside <Routes>:
<Route path="/contact" element={<Contact />} />
```

(`main`'s `App.tsx` is much smaller than `mvp-complete`'s — just slot the route
in next to whatever's there.)

### Step 9 — verify both builds locally

```bash
( cd backend && npm run build )
( cd frontend && npm run build )
```

Both should succeed. If frontend complains about `SiteFooter` imports from
pages other than Contact, you've accidentally dragged in extra files — those
edits live on `mvp-complete` and aren't needed here.

### Step 10 — smoke test against a running backend

```bash
# Terminal 1
cd backend && npm run dev
# Terminal 2
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test","email":"smoke@example.com","enquiryType":"general","message":"Hello from the contact form cherry-pick branch."}' \
  http://localhost:3000/api/contact
# Expect: { "success": true, "message": "Thanks — we'll be in touch within 48 hours." }
# Check privacy@menrush.com for the resulting email.
```

### Step 11 — open the PR

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(contact): add /contact page + /api/contact email route

- New backend route POST /api/contact validates with Zod and sends via Zoho
  Mail SMTP (nodemailer) to CONTACT_TO_EMAIL (defaults to privacy@menrush.com).
- New frontend page /contact with brand-matched form (name, email, enquiry
  type, message) calling contactAPI.submit.
- Adds shared SiteFooter component used by /contact (kept off other pages
  in this PR to minimise scope).
- Requires ZOHO_SMTP_USER, ZOHO_SMTP_PASS, CONTACT_TO_EMAIL,
  CONTACT_FROM_EMAIL env vars set on the deployed backend.

Tested locally end-to-end: form → backend → Zoho SMTP → privacy@menrush.com.
EOF
)"
git push -u origin contact-form-only
gh pr create --base main --title "feat(contact): contact page + Zoho-backed /api/contact" \
  --body "See docs/contact-cherry-pick.md for the construction recipe."
```

---

## What this PR deliberately does NOT include

These are tempting to fold in but each would explode the PR surface area:

- `SiteFooter` in **Privacy / Terms / Cookies / Login / Register / ComingSoon** —
  defer to a follow-up PR. The current `Privacy.tsx` on `main` keeps working
  as-is.
- The `/cookies` page (Cookie Policy) — separate PR.
- Updated `Terms.tsx` content — separate PR.
- The accessibility fix to `Register.tsx` (`aria-label` additions) — fine to
  defer.
- The contact-form code's later refactor onto `backend/src/services/mailer.service.ts`
  — that landed alongside the self-hosted drip work. Keep it standalone in
  this PR so the diff stays minimal.

---

## Rollback plan

If anything goes sideways after merge:

```bash
gh pr revert <pr-number>            # opens an automatic revert PR
# OR for an emergency rollback on the live site:
vercel rollback                      # via Vercel dashboard or CLI
```

Removing the backend route + env vars is safe — the `/contact` page just
fails with the "temporarily unavailable" message, which is the same UX
users see today (no form at all).

---

## Verification once merged + deployed

1. Visit https://menrush.com/contact — page renders with brand styling.
2. Submit a test message → wait for the success banner.
3. Check that the email arrives at `privacy@menrush.com` within ~30s.
4. Confirm `Reply-To` is the submitter's address (so hitting Reply in Zoho
   responds to them, not to `hello@menrush.com`).
5. Rate-limit smoke test: hit `/api/contact` 9 times in a minute — 9th request
   should return `429 Too Many Requests`.
