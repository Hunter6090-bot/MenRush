/**
 * Idempotent seed for the Oct 1 2026 launch social campaign (`oct1-2026`).
 *
 *   cd backend && npm run db:seed-social-oct1
 *
 * Safe to re-run: templates upsert on slug; posts use deterministic UUIDs
 * and INSERT … ON CONFLICT (id) DO NOTHING. Never publishes; never calls
 * platform APIs. See docs/social-oct1-2026.md.
 */
import 'dotenv/config';
import { v5 as uuidv5 } from 'uuid';
import pool, { query } from '../src/db';
import { renderTemplate, type SocialPlatform } from '../src/services/social.service';

export const CAMPAIGN = 'oct1-2026';
export const CTA = 'https://menrush.com';
export const LOGO = 'https://menrush.com/menrush-logo.png';
export const MEDIA_NOTE = `Official MenRush medallion logo (unmodified): ${LOGO}`;
export const CREATED_BY = 'seed-social-oct1-2026';

/** Fixed namespace so seed IDs stay stable across re-runs. */
const SEED_NS = '6f1c0a10-0c71-4b2e-9a3d-a1b2c3d4e5f6';

export function seedId(...parts: string[]): string {
  return uuidv5(parts.join(':'), SEED_NS);
}

type TemplateSeed = {
  slug: string;
  name: string;
  category: string;
  platforms: SocialPlatform[];
  bodyTemplate: string;
  variables: Array<{ key: string; label?: string; default?: string }>;
  defaultHashtags: string[];
};

export const TEMPLATES: TemplateSeed[] = [
  {
    slug: 'oct1-launch-signal',
    name: 'Oct1 — Launch signal',
    category: 'launch-signal',
    platforms: ['x', 'instagram', 'bluesky', 'tiktok'],
    bodyTemplate: `{{hook}}

{{body}}

{{cta_line}}
{{link}}`,
    variables: [
      { key: 'hook', label: 'Opening line', default: 'Built for men who know what they want.' },
      { key: 'body', label: 'Supporting lines', default: 'Fast chemistry. Nearby energy. Less noise.' },
      {
        key: 'cta_line',
        label: 'CTA line',
        default: 'Opens 1 October — UK first.',
      },
      { key: 'link', label: 'Link', default: CTA },
    ],
    defaultHashtags: [],
  },
  {
    slug: 'oct1-nearby-rooms',
    name: 'Oct1 — Nearby / rooms energy',
    category: 'nearby-rooms',
    platforms: ['x', 'instagram', 'bluesky', 'tiktok', 'reddit'],
    bodyTemplate: `{{hook}}

{{body}}

{{cta_line}}
{{link}}`,
    variables: [
      {
        key: 'hook',
        label: 'Opening line',
        default: 'See who is near you right now.',
      },
      {
        key: 'body',
        label: 'Supporting lines',
        default:
          'Map-first energy. Intentional rooms coming with the product — no fake catalog.',
      },
      {
        key: 'cta_line',
        label: 'CTA line',
        default: 'Waitlist open. Launch 1 October.',
      },
      { key: 'link', label: 'Link', default: CTA },
    ],
    defaultHashtags: [],
  },
  {
    slug: 'oct1-early-premium',
    name: 'Oct1 — Early Premium reward',
    category: 'early-premium',
    platforms: ['x', 'instagram', 'bluesky', 'tiktok'],
    bodyTemplate: `{{hook}}

{{body}}

{{cta_line}}
{{link}}`,
    variables: [
      {
        key: 'hook',
        label: 'Opening line',
        default: 'If you are early, we remember it.',
      },
      {
        key: 'body',
        label: 'Supporting lines',
        default: 'Waitlist members get 30 days of Premium free when MenRush launches.',
      },
      {
        key: 'cta_line',
        label: 'CTA line',
        default: 'No code hunting. Just a thank-you for showing up first.',
      },
      { key: 'link', label: 'Link', default: CTA },
    ],
    defaultHashtags: [],
  },
  {
    slug: 'oct1-founder-build',
    name: 'Oct1 — Founder / build in public',
    category: 'founder-build',
    platforms: ['x', 'instagram', 'bluesky', 'tiktok', 'reddit'],
    bodyTemplate: `{{hook}}

{{body}}

{{cta_line}}
{{link}}`,
    variables: [
      {
        key: 'hook',
        label: 'Opening line',
        default: 'Built in public.',
      },
      {
        key: 'body',
        label: 'Supporting lines',
        default: 'Real product. Real pressure. Real launch clock — 1 October.',
      },
      {
        key: 'cta_line',
        label: 'CTA line',
        default: 'Follow the build. Join early.',
      },
      { key: 'link', label: 'Link', default: CTA },
    ],
    defaultHashtags: [],
  },
  {
    slug: 'oct1-trust-discretion',
    name: 'Oct1 — Trust / discretion',
    category: 'trust-discretion',
    platforms: ['x', 'instagram', 'bluesky', 'tiktok', 'reddit'],
    bodyTemplate: `{{hook}}

{{body}}

{{cta_line}}
{{link}}`,
    variables: [
      {
        key: 'hook',
        label: 'Opening line',
        default: 'Adult. Discreet. Intentional.',
      },
      {
        key: 'body',
        label: 'Supporting lines',
        default:
          'Free verification badge for every user. Privacy controls that respect how you show up.',
      },
      {
        key: 'cta_line',
        label: 'CTA line',
        default: 'Trust before scale. Waitlist:',
      },
      { key: 'link', label: 'Link', default: CTA },
    ],
    defaultHashtags: [],
  },
];

type PostSeed = {
  /** Stable key → deterministic UUID */
  key: string;
  platform: SocialPlatform;
  templateSlug?: string;
  /** ISO date YYYY-MM-DD in UK calendar */
  date: string;
  /** HH:mm Europe/London intended slot */
  timeUk: string;
  body: string;
  week: number;
  kind: 'full' | 'outline';
};

/** UK wall-clock → timestamptz (BST UTC+1 for Aug–early Oct 2026). */
export function ukWallToUtcIso(date: string, timeUk: string): string {
  return `${date}T${timeUk}:00+01:00`;
}

function dayPosts(
  date: string,
  week: number,
  kind: 'full' | 'outline',
  copy: {
    xAm: string;
    xPm: string;
    ig: string;
    bluesky: string;
    tiktok: string;
    reddit?: string;
    templateSlug?: string;
  },
): PostSeed[] {
  const tpl = copy.templateSlug;
  const posts: PostSeed[] = [
    {
      key: `${date}:x:am`,
      platform: 'x',
      templateSlug: tpl,
      date,
      timeUk: '08:30',
      body: copy.xAm,
      week,
      kind,
    },
    {
      key: `${date}:x:pm`,
      platform: 'x',
      templateSlug: tpl,
      date,
      timeUk: '19:30',
      body: copy.xPm,
      week,
      kind,
    },
    {
      key: `${date}:instagram`,
      platform: 'instagram',
      templateSlug: tpl,
      date,
      timeUk: '19:30',
      body: copy.ig,
      week,
      kind,
    },
    {
      key: `${date}:bluesky`,
      platform: 'bluesky',
      templateSlug: tpl,
      date,
      timeUk: '13:00',
      body: copy.bluesky,
      week,
      kind,
    },
    {
      key: `${date}:tiktok`,
      platform: 'tiktok',
      templateSlug: tpl,
      date,
      timeUk: '19:00',
      body: copy.tiktok,
      week,
      kind,
    },
  ];
  if (copy.reddit) {
    posts.push({
      key: `${date}:reddit`,
      platform: 'reddit',
      templateSlug: tpl,
      date,
      timeUk: '15:00',
      body: copy.reddit,
      week,
      kind,
    });
  }
  return posts;
}

/** Weeks 1–2: full draft copy (18–31 Aug 2026). */
export function buildWeek1And2Posts(): PostSeed[] {
  const out: PostSeed[] = [];

  out.push(
    ...dayPosts('2026-08-18', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `Men are tired of apps that feel crowded, slow, and built for everyone except them.

MenRush opens 1 October — UK first.

Built for fast chemistry, local signal, and less noise.

Waitlist:
${CTA}`,
      xPm: `Built for men who know what they want.

Fast chemistry.
Nearby energy.
No wasted motion.

Opens 1 October.
${CTA}`,
      ig: `Built for men who know what they want.

No endless noise. No pretending. No waiting around for a maybe.

MenRush — 1 October. UK first.

Join the waitlist at menrush.com`,
      bluesky: `MenRush is being built for men who want less noise and more right-now signal.

Opens 1 October. Waitlist:
${CTA}`,
      tiktok: `POV: dating apps forgot what men actually want.

Beat: call out endless swiping, then introduce MenRush as speed, proximity, and intent.
CTA: waitlist at menrush.com — opens 1 October.`,
      reddit: `Title: What would make a dating app feel faster and less exhausting for men?

Body:
I am working on MenRush, a new app built around a simple question: who nearby is actually worth your attention right now?

The idea is less noise, less wasted motion, and more local signal. We open 1 October (UK first).

I would genuinely like to know what makes apps feel immediate instead of endless for you.

If anyone wants to follow the build, the waitlist is at ${CTA}`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-19', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `Most apps optimize for time spent.

MenRush is being built for momentum.

See who is nearby. Feel the signal faster. Move with intention.

Opens 1 October:
${CTA}`,
      xPm: `You do not need more matches that go nowhere.

You need better timing.
Better local signal.
Less noise.

${CTA}`,
      ig: `Not more swiping.

More signal.
More intent.
More right-now energy.

menrush.com — 1 October`,
      bluesky: `Most apps optimize for time spent.

MenRush is being built for momentum.

${CTA}`,
      tiktok: `What if a dating app felt immediate instead of exhausting?

Beat: contrast scrolling for hours with who is actually nearby now.
CTA: join early at menrush.com`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-20', 1, 'full', {
      templateSlug: 'oct1-early-premium',
      xAm: `If you are early, we remember it.

Waitlist members get 30 days of Premium free when MenRush launches.

Join now:
${CTA}`,
      xPm: `Early MenRush members get 30 days of Premium free at launch.

No code hunting. No gimmick. Just a thank-you for showing up first.

${CTA}`,
      ig: `Early gets rewarded.

Waitlist members get 30 days of Premium free at launch.

If that sounds like your kind of app, get on the list.

menrush.com`,
      bluesky: `Early MenRush waitlist members get 30 days of Premium free at launch.

${CTA}`,
      tiktok: `The first men in get 30 days of Premium free.

Beat: explain the waitlist reward in one sentence, then say what MenRush is built for.
CTA: menrush.com`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-21', 1, 'full', {
      templateSlug: 'oct1-founder-build',
      xAm: `Built in public.

Real product. Real pressure. Real launch clock — 1 October.

If you want in early:
${CTA}`,
      xPm: `No audience, no launch.

So we are saying it plainly:

MenRush is coming for men who want less friction and more signal.

${CTA}`,
      ig: `This is not vapor.

We are building MenRush in public, one sharp move at a time.

Join the list:
menrush.com`,
      bluesky: `We are building in public because launches need attention, not silence.

Waitlist:
${CTA}`,
      tiktok: `Here is what building under a launch clock actually looks like.

Beat: screen recording, launch checklist, or founder talking-head.
CTA: follow the build and join the waitlist.`,
      reddit: `Title: We are building a new app for men around speed, proximity, and intent

Body:
A lot of apps feel crowded, slow, and built to keep you scrolling.

We are trying something tighter with MenRush: more local context, faster chemistry, and less friction.

Still early — we open 1 October (UK first). I would genuinely like to know what would make an app like that worth trying for you.

Waitlist:
${CTA}`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-22', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `You do not need more matches that go nowhere.

You need better timing, better proximity, and less friction.

MenRush is on the way.
${CTA}`,
      xPm: `The first version should feel alive, not endless.

That is what we are building.

Waitlist open:
${CTA}`,
      ig: `Less friction.

More intent.

More local energy.

menrush.com`,
      bluesky: `MenRush is not trying to be everything.

It is trying to be sharp, local, and fast.

Join early:
${CTA}`,
      tiktok: `Why "more matches" is the wrong product goal.

Beat: timing, proximity, and intent matter more than match count.
CTA: join early at menrush.com`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-23', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `MenRush is being designed around one question:

Who is actually around, available, and worth your attention right now?

Waitlist:
${CTA}`,
      xPm: `The product question is simple:

Who nearby is actually worth your attention right now?

That is the lane.
${CTA}`,
      ig: `Who is around.
Who is available.
Who is worth your attention right now.

That is the question.

menrush.com`,
      bluesky: `The question behind MenRush:

who nearby is actually worth your attention right now?

${CTA}`,
      tiktok: `This is the product question every dating app should start with.

Beat: "Who is actually nearby and worth your attention right now?"
CTA: MenRush waitlist is live.`,
      reddit: `Comment angle: Ask for feature feedback without over-selling.

Copy:
If an app is built around nearby availability, what would you need to trust it? Better verification, clearer distance controls, stronger privacy settings, or something else?`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-24', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `Launches do not happen because products exist.

They happen because people feel something and tell someone else.

If MenRush sounds like your kind of app, join early:
${CTA}`,
      xPm: `MenRush is for men who want the room to feel faster, closer, and more intentional.

If that is you, get on the list:
${CTA}`,
      ig: `If this sounds like your kind of app, you are exactly who we want early.

Waitlist open now.

menrush.com — opens 1 October`,
      bluesky: `No audience, no launch.

MenRush is coming for men who want less friction, more signal, and a room that actually moves.

${CTA}`,
      tiktok: `No audience, no launch. So here is exactly who MenRush is for.

Beat: list the target user in direct language, then invite them into the waitlist.
CTA: menrush.com`,
    }),
  );

  // Week 2 — nearby / rooms energy
  out.push(
    ...dayPosts('2026-08-25', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `See who is near you right now.

That is the product truth MenRush is built around.

Map-first. Local. Immediate.

Waitlist — opens 1 October:
${CTA}`,
      xPm: `Not another endless grid.

A clearer read on who is actually around — when it matters.

${CTA}`,
      ig: `Map-first energy.

Who is nearby.
Who is available.
Who is worth your attention right now.

menrush.com`,
      bluesky: `Proximity without the noise.

MenRush opens 1 October — UK first.
${CTA}`,
      tiktok: `Hook: Stop swiping strangers across the country. Start with who is near you.

Beat: map energy, local signal, CTA waitlist.`,
      reddit: `Title: What does "nearby now" need to feel useful (not creepy) in a dating app?

Body:
Building MenRush around live proximity for men. Curious what distance, privacy, and intent controls would make you actually turn location on.

Waitlist if you want to follow: ${CTA}`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-26', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `Tired of chatting for weeks and never meeting?

See who is actually near you.

MenRush — 1 October.
${CTA}`,
      xPm: `Less chat-for-weeks.
More local signal.
More right-now intent.

${CTA}`,
      ig: `Less chat that goes nowhere.

More men who are actually nearby.

menrush.com`,
      bluesky: `Less chat-for-weeks. More local signal.

${CTA}`,
      tiktok: `Hook: The group chat lasted three weeks. Nobody met.

Beat: nearby presence vs endless texting. CTA waitlist.`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-27', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `Rooms are coming with the product — intentional spaces, not a fake catalog today.

MenRush opens 1 October.
${CTA}`,
      xPm: `Presence first.
Rooms when we ship.
No invented inventory.

Follow the build:
${CTA}`,
      ig: `Nearby energy.
Intentional rooms at launch.

We will say when they are open — not before.

menrush.com`,
      bluesky: `Rooms ship with the product. No fake live catalog.

Opens 1 October.
${CTA}`,
      tiktok: `Hook: We are not pretending rooms are live.

Beat: honest build — nearby + rooms at launch. CTA waitlist.`,
      reddit: `Comment angle: In a thread about group chats / rooms on dating apps.

Copy:
We are shipping rooms with MenRush at launch (1 Oct, UK first) — not claiming a live catalog now. Curious what makes a room feel useful vs noisy for you.`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-28', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `Friday energy should feel local.

Who is around. Who is free. Who is worth the message.

MenRush — 1 October.
${CTA}`,
      xPm: `Night proximity without the spam.

Built for men who know what they want.
${CTA}`,
      ig: `Weekend proximity.
Less noise.
More signal.

menrush.com`,
      bluesky: `Local Friday energy. Less noise.

${CTA}`,
      tiktok: `Hook: Your Friday night app should know who is near you.

Beat: map / presence vibe. CTA waitlist.`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-29', 2, 'full', {
      templateSlug: 'oct1-trust-discretion',
      xAm: `Discreet does not mean invisible.

It means you control how you show up — and still find who is nearby.

${CTA}`,
      xPm: `Adult. Premium. Direct.

MenRush is built for men who want presence without the circus.
${CTA}`,
      ig: `Discretion with presence.

See who is near you — on your terms.

menrush.com`,
      bluesky: `Discretion with presence. That is the balance.

${CTA}`,
      tiktok: `Hook: You can be discreet and still find who is nearby.

Beat: control + proximity. CTA waitlist.`,
      reddit: `Title: How do you balance discretion with actually meeting people nearby?

Body:
Designing MenRush for men who want local signal without oversharing. What privacy defaults would you need before turning location on?

${CTA}`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-30', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `Soft ask:

If MenRush opened tomorrow, what nearby feature would you use first — map, filters, or rooms?

Tell us. Then get on the list:
${CTA}`,
      xPm: `We are listening before 1 October.

What would make nearby feel useful for you?
${CTA}`,
      ig: `What would you use first?

Map. Filters. Rooms.

Tell us — then join early.
menrush.com`,
      bluesky: `What nearby feature would you use first?

${CTA}`,
      tiktok: `Hook: Map, filters, or rooms — what do you open first?

Beat: poll-style, genuine ask. CTA waitlist.`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-31', 2, 'full', {
      templateSlug: 'oct1-early-premium',
      xAm: `Bridge to September:

Waitlist members still get 30 days of Premium free at launch.

Early means something.
${CTA}`,
      xPm: `One month out from October.

Stay early. Stay on the list.
${CTA}`,
      ig: `Early still gets rewarded.

30 days Premium free at launch for waitlist members.

menrush.com`,
      bluesky: `30 days Premium free at launch for waitlist members.

${CTA}`,
      tiktok: `Hook: One month out. Early still matters.

Beat: Premium thank-you + 1 Oct date. CTA waitlist.`,
    }),
  );

  return out;
}

/** Weeks 3–launch: outline stubs (expand before approval). */
export function buildOutlinePosts(): PostSeed[] {
  const weeks: Array<{
    week: number;
    templateSlug: string;
    dates: string[];
    theme: string;
    redditDates: string[];
  }> = [
    {
      week: 3,
      templateSlug: 'oct1-early-premium',
      dates: [
        '2026-09-01',
        '2026-09-02',
        '2026-09-03',
        '2026-09-04',
        '2026-09-05',
        '2026-09-06',
        '2026-09-07',
      ],
      theme: 'Early Premium — 30 days free for waitlist at launch. Thank-you tone, no fake scarcity.',
      redditDates: ['2026-09-02', '2026-09-05'],
    },
    {
      week: 4,
      templateSlug: 'oct1-founder-build',
      dates: [
        '2026-09-08',
        '2026-09-09',
        '2026-09-10',
        '2026-09-11',
        '2026-09-12',
        '2026-09-13',
        '2026-09-14',
      ],
      theme: 'Founder / build in public. Real notes only — no invented metrics. Product questions welcome.',
      redditDates: ['2026-09-10', '2026-09-13'],
    },
    {
      week: 5,
      templateSlug: 'oct1-trust-discretion',
      dates: [
        '2026-09-15',
        '2026-09-16',
        '2026-09-17',
        '2026-09-18',
        '2026-09-19',
        '2026-09-20',
        '2026-09-21',
      ],
      theme:
        'Trust / discretion. Free verification badge for all. Adult & discreet. Do not overclaim location privacy.',
      redditDates: ['2026-09-16', '2026-09-19'],
    },
    {
      week: 6,
      templateSlug: 'oct1-launch-signal',
      dates: [
        '2026-09-22',
        '2026-09-23',
        '2026-09-24',
        '2026-09-25',
        '2026-09-26',
        '2026-09-27',
        '2026-09-28',
      ],
      theme: 'Countdown to 1 October. Clear date. UK first. Keep cadence — do not spam.',
      redditDates: ['2026-09-24', '2026-09-27'],
    },
    {
      week: 7,
      templateSlug: 'oct1-launch-signal',
      dates: ['2026-09-29', '2026-09-30', '2026-10-01'],
      theme:
        'Launch window. 29 Sep final push; 30 Sep calm confidence; 1 Oct opening day UK-first. Honour early Premium.',
      redditDates: ['2026-09-29'],
    },
  ];

  const out: PostSeed[] = [];
  for (const w of weeks) {
    for (const date of w.dates) {
      const outlineBody = (slot: string) =>
        `[OUTLINE · week ${w.week} · ${date} · ${slot}]
Theme: ${w.theme}
Expand to final copy before submit-for-approval.
CTA: ${CTA}
Default media: ${LOGO}`;

      out.push(
        ...dayPosts(date, w.week, 'outline', {
          templateSlug: w.templateSlug,
          xAm: outlineBody('X AM'),
          xPm: outlineBody('X PM'),
          ig: outlineBody('Instagram'),
          bluesky: outlineBody('Bluesky'),
          tiktok: outlineBody('TikTok hook'),
          reddit: w.redditDates.includes(date) ? outlineBody('Reddit') : undefined,
        }),
      );
    }
  }
  return out;
}

export function buildAllPosts(): PostSeed[] {
  return [...buildWeek1And2Posts(), ...buildOutlinePosts()];
}

export async function upsertTemplates(): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();

  for (const t of TEMPLATES) {
    const id = seedId('template', t.slug);
    await query(
      `INSERT INTO social_post_templates
         (id, slug, name, category, platforms, body_template, variables, default_hashtags, media_note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         platforms = EXCLUDED.platforms,
         body_template = EXCLUDED.body_template,
         variables = EXCLUDED.variables,
         default_hashtags = EXCLUDED.default_hashtags,
         media_note = EXCLUDED.media_note,
         updated_at = NOW(),
         archived_at = NULL
       RETURNING id, slug`,
      [
        id,
        t.slug,
        t.name,
        t.category,
        t.platforms,
        t.bodyTemplate,
        JSON.stringify(t.variables),
        t.defaultHashtags,
        MEDIA_NOTE,
        CREATED_BY,
      ],
    );
    const row = await query('SELECT id FROM social_post_templates WHERE slug = $1', [t.slug]);
    slugToId.set(t.slug, (row.rows[0] as { id: string }).id);
  }

  return slugToId;
}

export async function insertPosts(slugToId: Map<string, string>): Promise<{
  inserted: number;
  skipped: number;
  total: number;
}> {
  const posts = buildAllPosts();
  let inserted = 0;
  let skipped = 0;

  for (const p of posts) {
    const id = seedId('post', CAMPAIGN, p.key);
    const templateId = p.templateSlug ? slugToId.get(p.templateSlug) ?? null : null;
    const scheduledFor = ukWallToUtcIso(p.date, p.timeUk);
    const variables = {
      seedKey: p.key,
      week: String(p.week),
      kind: p.kind,
      date: p.date,
      slot: p.timeUk,
    };

    const result = await query(
      `INSERT INTO social_posts
         (id, template_id, platform, status, campaign, variables, rendered_body, hashtags, media_urls, link_url, scheduled_for, created_by)
       VALUES ($1, $2, $3, 'draft', $4, $5::jsonb, $6, '{}', $7, $8, $9::timestamptz, $10)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        id,
        templateId,
        p.platform,
        CAMPAIGN,
        JSON.stringify(variables),
        p.body,
        [LOGO],
        CTA,
        scheduledFor,
        CREATED_BY,
      ],
    );

    if (result.rowCount && result.rowCount > 0) inserted += 1;
    else skipped += 1;
  }

  return { inserted, skipped, total: posts.length };
}

export async function seedSocialOct1(): Promise<{
  templates: number;
  posts: { inserted: number; skipped: number; total: number };
}> {
  const slugToId = await upsertTemplates();
  const posts = await insertPosts(slugToId);
  return { templates: TEMPLATES.length, posts };
}

/** Smoke: templates render with defaults. */
export function assertTemplatesRender(): void {
  for (const t of TEMPLATES) {
    const defaults: Record<string, string> = {};
    for (const v of t.variables) {
      if (v.default !== undefined) defaults[v.key] = v.default;
    }
    const rendered = renderTemplate(t.bodyTemplate, defaults);
    if (rendered.includes('{{')) {
      throw new Error(`Template ${t.slug} left unresolved placeholders: ${rendered}`);
    }
    if (!rendered.includes(CTA) && !defaults.link) {
      throw new Error(`Template ${t.slug} missing CTA after render`);
    }
  }
}

async function main() {
  assertTemplatesRender();
  const result = await seedSocialOct1();
  console.log(
    JSON.stringify(
      {
        ok: true,
        campaign: CAMPAIGN,
        templates: result.templates,
        posts: result.posts,
        note: 'All posts remain draft. Nothing published. Re-run is safe.',
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end().finally(() => process.exit(1));
    });
}
