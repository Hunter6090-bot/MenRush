# MenRush Social Calendar: Oct 1 2026 Launch

Campaign slug: `oct1-2026`  
Opening day: **1 October 2026** (UK-first)  
Primary CTA: `https://menrush.com`  
Approval model: draft first, human approve before publish. **Nothing auto-publishes.**

This replaces the unshipped June 2026 waitlist week in `docs/social-launch-week-one.md`. Do not reuse June dates or that campaign’s schedule.

## Positioning

- MenRush is for men who know what they want.
- Hook: speed, proximity, less noise.  see who’s near you right now.
- Conversion goal: waitlist at menrush.com until opening day; then launch/join.
- Early waitlist members still get **30 days of Premium** free when MenRush launches.
- Tone: direct, premium, adult, confident.  not spammy, not desperate, not explicit.
- Default visual: official medallion logo at `https://menrush.com/menrush-logo.png` (unmodified).
- Do not invent follower counts, live handles beyond the known accounts, or claim the rooms catalog is live.

## Copy house rules

- No em dashes, en dashes, or dash asides. Use periods, commas, or parentheses. Hyphens in words and URLs stay.
- Hashtags: Instagram all five `#GayMen #LGBTQ #GayLondon #GayUK #GayDating`. X only `#GayMen #GayUK`. Bluesky `#GayMen #LGBTQ #GayUK`. Never `#MenRush`, `#Waitlist`, or `#NewApp`.
- CTA is always `https://menrush.com`. Do not claim rooms are live. Early waitlist still gets 30 days of Premium at launch.
- Approve is the only publish action. Nothing auto-publishes.

## Known handles (do not invent others)

- X: @menrushsocial
- Instagram: @menrushsocial
- TikTok: @menrushsocial
- Bluesky: @menrush.bsky.social
- Reddit: u/MenRush

## Cadence (daily minimums)

| Channel | Daily minimum | Best UK windows | Notes |
|---|---:|---|---|
| X | 2 posts | 08:30 and 19:30 | Founder voice, build-in-public, fast hook testing. |
| Instagram | 1 feed post or story | 19:30 | Schedule through Metricool. Logo or approved poster only. |
| TikTok | 1 draft or post | 18:30-21:00 | Manual-first. Hooks as short scripts, not polished ads. |
| Bluesky | 1 post | 13:00 | Crisp, conversational, lower-pressure than X. |
| Reddit | 1 contribution every 2-3 days | 12:00-20:00 | Real questions. No spammy link drops. |

Daily operator loop:

1. Approve today’s copy and asset by 10:00 UK.
2. Queue Instagram in Metricool as a draft first.
3. Post X AM manually (or via approved external tool), then watch replies ~30 minutes.
4. Publish or schedule Bluesky around 13:00.
5. Use TikTok hook as a 15-25s founder-style clip or text-on-screen concept.
6. Log shipped posts, clicks, replies, follows, profile visits, saves, Reddit comments, waitlist signups.
7. After shipping outside this system, mark the row published via `POST /api/social/posts/:id/publish` (record only.  no platform API).

## Six-week run-up (from week of 21 Aug 2026 to 1 Oct)

| Week | Dates (UK) | Theme | Content focus |
|---|---|---|---|
| 1 | 21-27 Aug | Launch signal | Positioning, anti-noise, “built for men who know what they want.” |
| 2 | 28 Aug-3 Sep | Nearby / rooms energy | Proximity truth, “who’s near you right now,” rooms as *coming* atmosphere.  not a live catalog claim. |
| 3 | 4-10 Sep | Early Premium | Waitlist → 30 days Premium at launch. Clean thank-you, no fake scarcity. |
| 4 | 11-17 Sep | Founder / build | Build-in-public, launch clock, product questions. |
| 5 | 18-24 Sep | Trust / discretion | Privacy, verification as free trust layer, adult & discreet. |
| 6 | 25-28 Sep | Countdown pressure | Closing the gap to 1 Oct. Momentum without spam. |
| Launch | 29 Sep-1 Oct | Opening day | UK-first open. Waitlist → live. Premium early reward still honoured. |

Seed status in DB:

- **Weeks 1-2 (21 Aug-3 Sep):** full draft posts (X AM/PM, IG, Bluesky, TikTok hooks; Reddit every 2-3 days).
- **Weeks 3-launch:** outline / template-backed stubs so operators expand copy before approval.

All seeded rows start as `draft` with `campaign = 'oct1-2026'` and `link_url = 'https://menrush.com'`.

---

## Week 1: Launch signal (21-27 Aug 2026)

### Fri 21 Aug: Opening signal (Day 1)

**X AM (08:30):**

```text
Men are tired of apps that feel crowded, slow, and built for everyone except them.

MenRush opens 1 October (UK first).

Built for fast chemistry, local signal, and less noise.

Waitlist:
https://menrush.com
```

**X PM (19:30):**

```text
Built for men who know what they want.

Fast chemistry.
Nearby energy.
No wasted motion.

Opens 1 October.
https://menrush.com
```

**Instagram (19:30):**

```text
Built for men who know what they want.

No endless noise. No pretending. No waiting around for a maybe.

MenRush. 1 October (UK first).

Join the waitlist at menrush.com
```

**TikTok hook (evening):**

```text
POV: dating apps forgot what men actually want.

Beat: call out endless swiping, then introduce MenRush as speed, proximity, and intent.
CTA: waitlist at menrush.com. Opens 1 October.
```

**Bluesky (13:00):**

```text
MenRush is being built for men who want less noise and more right-now signal.

Opens 1 October. Waitlist:
https://menrush.com
```

**Reddit (contribution day):**

```text
Title: What would make a dating app feel faster and less exhausting for men?

Body:
I am working on MenRush, a new app built around a simple question: who nearby is actually worth your attention right now?

The idea is less noise, less wasted motion, and more local signal. We open 1 October (UK first).

I would genuinely like to know what makes apps feel immediate instead of endless for you.

If anyone wants to follow the build, the waitlist is at https://menrush.com
```

### Sat 22 Aug: Momentum

**X AM:** Most apps optimize for time spent. MenRush is built for momentum. See who is nearby. Move with intention. Opens 1 Oct → menrush.com  
**X PM:** You do not need more matches that go nowhere. You need better timing and local signal. https://menrush.com  
**IG:** Not more swiping. More signal. More intent. More right-now energy. menrush.com  
**TikTok:** What if a dating app felt immediate instead of exhausting? Contrast scrolling-for-hours vs who’s nearby now.  
**Bluesky:** Most apps optimize for time spent. MenRush is built for momentum. https://menrush.com

### Sun 23 Aug: Early reward tease

**X AM:** If you are early, we remember it. Waitlist members get 30 days of Premium free when MenRush launches. https://menrush.com  
**X PM:** No code hunting. No gimmick. Just a thank-you for showing up first. https://menrush.com  
**IG:** Early gets rewarded. 30 days Premium free at launch for waitlist. menrush.com  
**TikTok:** The first men in get 30 days of Premium free. One sentence on the reward, one on what MenRush is.  
**Bluesky:** Early waitlist members get 30 days of Premium free at launch. https://menrush.com

### Mon 24 Aug: Built in public

**X AM:** Built in public. Real product. Real pressure. Real launch clock. 1 October. https://menrush.com  
**X PM:** No audience, no launch. Saying it plainly: MenRush is coming for men who want less friction and more signal.  
**IG:** This is not vapor. Building MenRush in public, one sharp move at a time. menrush.com  
**TikTok:** What building under a launch clock actually looks like. Screen / checklist / founder talking-head.  
**Bluesky:** Building in public because launches need attention, not silence. https://menrush.com  
**Reddit:** Transparent build post.  speed, proximity, intent; ask what would make it worth trying.

### Tue 25 Aug: Less friction

**X AM:** Better timing, better proximity, less friction. MenRush is on the way. https://menrush.com  
**X PM:** The first version should feel alive, not endless. That is what we are building.  
**IG:** Less friction. More intent. More local energy. menrush.com  
**TikTok:** Why “more matches” is the wrong product goal. Timing + proximity + intent.  
**Bluesky:** Not trying to be everything. Sharp, local, and fast. https://menrush.com

### Wed 26 Aug: Product question

**X AM / PM:** Who is actually around, available, and worth your attention right now? That is the lane.  
**IG / Bluesky / TikTok:** Same question, platform-fit length.  
**Reddit (optional comment):** What would you need to trust a nearby-availability app?

### Thu 27 Aug: Audience push

**X AM:** Launches happen because people feel something and tell someone else. If MenRush is your kind of app.  join early.  
**X PM:** For men who want the room to feel faster, closer, more intentional. https://menrush.com  
**IG / TikTok / Bluesky:** Direct invite. No invented social proof.

---

## Week 2: Nearby / rooms energy (28 Aug-3 Sep 2026)

Do **not** claim a live rooms catalog. Talk atmosphere and intent: nearby presence, rooms *coming* with the product, map-first energy.

Themes by day:

| Day | Angle |
|---|---|
| Thu 3 Sep | Map-first: see who’s near you right now |
| Tue 1 Sep | Less chat-for-weeks, more local signal |
| Wed 2 Sep | Rooms as intentional spaces (coming at launch.  no fake inventory) |
| Thu 3 Sep | Night energy / weekend proximity |
| Tue 1 Sep | Discretion + presence (who’s actually around) |
| Wed 2 Sep | Soft ask: what nearby feature would you use first? |
| Thu 3 Sep | Bridge to early Premium week |

Reddit every 2-3 days: genuine questions about proximity apps, privacy, and what “nearby now” should mean.  not hard-sell threads.

Full copy for Week 2 lives in the seeded `oct1-2026` drafts (same platforms as Week 1).

---

## Weeks 3-6 + launch.  outlines (expand before approve)

### Week 3 (4-10 Sep): Early Premium

- Lead with the 30-day Premium waitlist reward; clarify it is a thank-you, not a countdown gimmick.
- Alternate X AM product truth / X PM reward reminder.
- IG: clean offer card + logo.
- TikTok: 15s “here’s what early gets you.”
- Reddit: discuss launch incentives honestly in build-in-public spaces.

### Week 4 (11-17 Sep).  Founder / build

- Ship real build notes (no fake metrics).
- Product questions: radius, verification, discretion controls.
- One Reddit AMA-style prompt mid-week if bandwidth allows.

### Week 5 (18-24 Sep).  Trust / discretion

- Free verification badge for every user (not a Premium upsell).
- Location privacy: discovery uses obfuscated map points for others.  never overclaim.
- Adult, discreet, intentional.  reject sleazy hooks.

### Week 6 (25-28 Sep).  Countdown

- Date-stamp the open: **1 October 2026, UK first.**
- Increase CTA clarity; keep cadence, do not spam.
- Prep Metricool rows for launch week only after human approval.

### Launch window (29 Sep-1 Oct)

| Day | Focus |
|---|---|
| Mon 29 | Final waitlist push + “opens Thursday” |
| Tue 30 | Calm confidence; reply bank active |
| Wed 1 Oct | Opening day. UK-first. Waitlist members → early Premium path. CTA still menrush.com |

Opening-day sample (approve before ship):

```text
MenRush is open (UK first).
Built for men who know what they want.

See who’s near you right now.
https://menrush.com
```

---

## Instagram Stories (rotate)

- Would you use a map-first app for men? Yes / Depends how it works
- What matters more? Nearby now / More matches
- Waitlist → 30 days Premium free at launch
- Built for men who know what they want
- Less noise. More right-now signal.
- Opens 1 October. menrush.com

## Reply bank

- Would use it: `That is exactly who MenRush is for. Get on the list early: https://menrush.com`
- Complains about existing apps: `That friction is exactly the problem we are building around.`
- What’s different: `Speed, local signal, and less noise. That is the core idea.`
- Premium: `Early waitlist members get 30 days of Premium free when we launch.`
- Launch timing: `We open 1 October (UK first). Updates go to the waitlist first: https://menrush.com`
- Skeptical: `Fair. New apps have to earn trust. That is why we keep the build public and the early list tight.`
- Rooms live yet?: `Rooms ship with the product at launch. No fake catalog.  we’ll say when they’re open.`

## Metricool CSV notes

Use Metricool for Instagram scheduling first. Keep all rows as drafts until approved.

Required columns:

```csv
Text,Date,Time,Draft,Facebook,Twitter/X,LinkedIn,GBP,Instagram,Pinterest,TikTok,YouTube,Threads,Bluesky,Picture Url 1,Alt text picture 1,Instagram Post Type,Shortener,Brand name
```

Defaults:

- `Draft`: `TRUE`
- `Instagram`: `TRUE` for IG-only imports; other platform booleans `FALSE`
- `Picture Url 1`: `https://menrush.com/menrush-logo.png` unless an approved campaign poster is ready
- `Alt text picture 1`: `MenRush official logo`
- `Instagram Post Type`: `POST`
- `Shortener`: `FALSE`
- Timezone: **Europe/London** before scheduling
- Prefer importing only the next 2-3 approved days; leave the rest editable

Example row (21 Aug 2026):

```csv
"Built for men who know what they want.

No endless noise. No pretending. No waiting around for a maybe.

MenRush. 1 October (UK first).

Join the waitlist at menrush.com",2026-08-21,19:30:00,TRUE,FALSE,FALSE,FALSE,FALSE,TRUE,FALSE,FALSE,FALSE,FALSE,FALSE,https://menrush.com/menrush-logo.png,MenRush official logo,POST,FALSE,
```

## Ops: seed + API

```bash
cd backend
npm run db:migrate
npm run db:seed-social-oct1   # idempotent.  safe to re-run
```

- List drafts: `GET /api/social/posts?campaign=oct1-2026` with `X-Admin-Token`
- Templates: `GET /api/social/templates?category=oct1-2026` (or by slug)
- Human posts outside the system, then `POST /api/social/posts/:id/publish` with `{ "publishedVia": "manual" }`

There is no social admin UI in-app; the markdown pack + `/api/social` are the operator surface.
