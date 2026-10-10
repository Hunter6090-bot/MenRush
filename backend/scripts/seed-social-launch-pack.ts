/**
 * Idempotent seed for the launch pack social campaign (stored campaign id `oct1-2026`).
 *
 *   cd backend && npm run db:seed-social-launch-pack
 *
 * Safe to re-run: templates upsert on slug; posts use deterministic UUIDs
 * and INSERT … ON CONFLICT (id) DO NOTHING. Never publishes; never calls
 * platform APIs. See docs/social-launch-pack.md.
 */
import 'dotenv/config';
import { v5 as uuidv5 } from 'uuid';
import pool, { query } from '../src/db';
import { renderTemplate, type SocialPlatform } from '../src/services/social.service';

// Stored identifier: post ids (seedId) and Social Studio's campaign filter use it, so it
// keeps its original value. Template slugs below are stored identifiers too.
export const CAMPAIGN = 'oct1-2026';
export const CTA = 'https://menrush.com';
export const LOGO = 'https://menrush.com/menrush-logo.png';
export const MEDIA_NOTE = `Official MenRush medallion logo (unmodified): ${LOGO}`;
export const CREATED_BY = 'seed-social-launch-pack';

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
    name: 'Launch pack. Launch signal',
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
        default: 'Open in the UK. Free to join.',
      },
      { key: 'link', label: 'Link', default: CTA },
    ],
    defaultHashtags: [],
  },
  {
    slug: 'oct1-nearby-rooms',
    name: 'Launch pack. Nearby energy',
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
        default: 'See who is near you.',
      },
      {
        key: 'body',
        label: 'Supporting lines',
        default:
          'Map-first energy. Who is close, who is free, who is worth the message.',
      },
      {
        key: 'cta_line',
        label: 'CTA line',
        default: 'Sign up free and open the map.',
      },
      { key: 'link', label: 'Link', default: CTA },
    ],
    defaultHashtags: [],
  },
  {
    slug: 'oct1-early-premium',
    name: 'Launch pack. Open now, free to join',
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
        default: 'MenRush is open in the UK.',
      },
      {
        key: 'body',
        label: 'Supporting lines',
        default: 'Sign up free at menrush.com.',
      },
      {
        key: 'cta_line',
        label: 'CTA line',
        default: 'No code hunting. Free to join.',
      },
      { key: 'link', label: 'Link', default: CTA },
    ],
    defaultHashtags: [],
  },
  {
    slug: 'oct1-founder-build',
    name: 'Launch pack. Founder / build in public',
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
        default: 'Real product. Real fixes shipped every week.',
      },
      {
        key: 'cta_line',
        label: 'CTA line',
        default: 'Follow the build. Try it free.',
      },
      { key: 'link', label: 'Link', default: CTA },
    ],
    defaultHashtags: [],
  },
  {
    slug: 'oct1-trust-discretion',
    name: 'Launch pack. Trust / discretion',
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
          'You choose how you show up. Privacy controls that respect that.',
      },
      {
        key: 'cta_line',
        label: 'CTA line',
        default: 'Trust before scale. Sign up free:',
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

/** UK wall-clock → timestamptz (BST UTC+1 for Aug-early Oct 2026). */
export function ukWallToUtcIso(date: string, timeUk: string): string {
  return `${date}T${timeUk}:00+01:00`;
}

const PLATFORM_TAGS: Partial<Record<SocialPlatform, string[]>> = {
  x: ['#GayMen', '#GayUK'],
  instagram: ['#GayMen', '#LGBTQ', '#GayLondon', '#GayUK', '#GayDating'],
  bluesky: ['#GayMen', '#LGBTQ', '#GayUK'],
};

const FORBIDDEN_TAGS = ['#MenRush', '#Waitlist', '#NewApp'];

/** House rules: no em/en dashes; platform hashtags. */
export function polishSocialCopy(body: string, platform: SocialPlatform): string {
  let s = String(body || '');
  // Strip em dash (U+2014) and en dash (U+2013) asides only.
  s = s.replace(/\s*\u2014\s*UK first/gi, ' (UK first)');
  s = s.replace(/\s*\u2013\s*UK first/gi, ' (UK first)');
  s = s.replace(/\s*\u2014\s*opens 1 October/gi, '. Opens 1 October');
  s = s.replace(/\s*\u2013\s*opens 1 October/gi, '. Opens 1 October');
  s = s.replace(/menrush\.com\s*[\u2014\u2013]\s*/gi, 'menrush.com. ');
  s = s.replace(/MenRush\s*[\u2014\u2013]\s*/gi, 'MenRush. ');
  s = s.replace(/clock\s*[\u2014\u2013]\s*/gi, 'clock. ');
  s = s.replace(/\s*[\u2014\u2013]\s*/g, '. ');
  for (const bad of FORBIDDEN_TAGS) {
    s = s.replace(new RegExp(bad.replace('#', '\\#'), 'gi'), '');
  }
  s = s.replace(/\.\s*\./g, '.').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  const tags = PLATFORM_TAGS[platform];
  if (tags?.length) {
    const missing = tags.filter((t) => !new RegExp(t.replace('#', '\\#'), 'i').test(s));
    if (missing.length) s = `${s}\n\n${missing.join(' ')}`;
  }
  return s;
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
      body: polishSocialCopy(copy.xAm, 'x'),
      week,
      kind,
    },
    {
      key: `${date}:x:pm`,
      platform: 'x',
      templateSlug: tpl,
      date,
      timeUk: '19:30',
      body: polishSocialCopy(copy.xPm, 'x'),
      week,
      kind,
    },
    {
      key: `${date}:instagram`,
      platform: 'instagram',
      templateSlug: tpl,
      date,
      timeUk: '19:30',
      body: polishSocialCopy(copy.ig, 'instagram'),
      week,
      kind,
    },
    {
      key: `${date}:bluesky`,
      platform: 'bluesky',
      templateSlug: tpl,
      date,
      timeUk: '13:00',
      body: polishSocialCopy(copy.bluesky, 'bluesky'),
      week,
      kind,
    },
    {
      key: `${date}:tiktok`,
      platform: 'tiktok',
      templateSlug: tpl,
      date,
      timeUk: '19:00',
      body: polishSocialCopy(copy.tiktok, 'tiktok'),
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
      body: polishSocialCopy(copy.reddit, 'reddit'),
      week,
      kind,
    });
  }
  return posts;
}

/** Weeks 1-2: full draft copy (21 Aug-3 Sep 2026 slots). Written open-now: every post tells one timeline (MenRush is open in the UK, free to join). */
export function buildWeek1And2Posts(): PostSeed[] {
  const out: PostSeed[] = [];

  out.push(
    ...dayPosts('2026-08-21', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `Men are tired of apps that feel crowded, slow, and built for everyone except them.

MenRush is open in the UK. Fast chemistry, local signal, less noise.

Sign up free:
${CTA}`,
      xPm: `Built for men who know what they want.

Fast chemistry.
Nearby energy.
No wasted motion.

${CTA}`,
      ig: `Built for men who know what they want.

No endless noise. No pretending. No waiting around for a maybe.

MenRush is open, UK first.

Join free at menrush.com`,
      bluesky: `MenRush is for men who want less noise and more local signal.

Open in the UK and free to join:
${CTA}`,
      tiktok: `POV: most apps forgot what men actually want.

Beat: call out endless swiping, then show MenRush as speed, proximity, and intent.
CTA: join free at menrush.com.`,
      reddit: `Title: What would make an app for gay men feel faster and less exhausting?

Body:
I work on MenRush, an app built around a simple question: who nearby is actually worth your attention?

The idea is less noise, less wasted motion, and more local signal. It is open in the UK.

I would genuinely like to know what makes apps feel immediate instead of endless for you.

If you want to try it, it is free at ${CTA}`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-22', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `Most apps optimise for time spent.

MenRush is built for momentum.

See who is nearby. Feel the signal faster. Move with intention.

${CTA}`,
      xPm: `You do not need more matches that go nowhere.

You need better timing.
Better local signal.
Less noise.

Try MenRush free:
${CTA}`,
      ig: `Not more swiping.

More signal.
More intent.
More men close by.

menrush.com`,
      bluesky: `Time spent is the wrong goal for an app like this. Momentum is the right one.

That is MenRush:
${CTA}`,
      tiktok: `What if an app for gay men felt immediate instead of exhausting?

Beat: contrast scrolling for hours with who is actually nearby tonight.
CTA: free at menrush.com.`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-23', 1, 'full', {
      templateSlug: 'oct1-early-premium',
      xAm: `MenRush is open in the UK.

Making an account costs nothing. Open the map and see who is nearby.

${CTA}`,
      xPm: `No code hunting. No gimmick.

Make a free profile and see who is around you.

${CTA}`,
      ig: `Free to join.

Make a profile, share your location when you want to, and see who is close.

If that sounds like your kind of app: menrush.com`,
      bluesky: `Joining MenRush is free. One profile, one map, men close by.

${CTA}`,
      tiktok: `Hook: It costs nothing to see who is near you.

Beat: one sentence on free sign-up, then what MenRush is built for.
CTA: menrush.com.`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-24', 1, 'full', {
      templateSlug: 'oct1-founder-build',
      xAm: `Built in public.

Real product. Real fixes shipped every week.

${CTA}`,
      xPm: `We say it plainly:

MenRush is for men who want less friction and more signal.

${CTA}`,
      ig: `This is not vapor.

MenRush is open, and we keep improving it one sharp move at a time.

menrush.com`,
      bluesky: `We build MenRush in public, because quiet products stay quiet.

Take a look:
${CTA}`,
      tiktok: `Here is what shipping fixes to a live app actually looks like.

Beat: screen recording of the map, or a founder talking head.
CTA: try it free at menrush.com.`,
      reddit: `Title: We built an app for men around speed, proximity, and intent

Body:
A lot of apps feel crowded, slow, and built to keep you scrolling.

We tried something tighter with MenRush: more local context, faster chemistry, and less friction. It is open in the UK.

I would genuinely like to know what would make an app like that worth keeping for you.

${CTA}`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-25', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `You need better timing, better proximity, and less friction.

MenRush is open.
${CTA}`,
      xPm: `An app should feel alive, not endless.

That is what we built.

Sign up free:
${CTA}`,
      ig: `Less friction.

More intent.

More local energy.

menrush.com`,
      bluesky: `MenRush is not trying to be everything.

It is trying to be sharp, local, and fast.

${CTA}`,
      tiktok: `Why "more matches" is the wrong goal.

Beat: timing, proximity, and intent matter more than match count.
CTA: join free at menrush.com.`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-26', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `MenRush is designed around one question:

Who is actually around, available, and worth your attention?

${CTA}`,
      xPm: `The question is simple:

Who nearby is worth the message?

That is the lane.
${CTA}`,
      ig: `Who is around.
Who is available.
Who is worth your attention.

That is the question.

menrush.com`,
      bluesky: `The question behind MenRush:

who close by is actually worth your time tonight?

${CTA}`,
      tiktok: `This is the question every app for gay men should start with.

Beat: "Who is actually nearby and worth your attention?"
CTA: menrush.com, free to join.`,
      reddit: `Comment angle: Ask for feature feedback without over-selling.

Copy:
If an app is built around nearby availability, what would you need to trust it? Better verification, clearer distance controls, stronger privacy settings, or something else?`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-27', 1, 'full', {
      templateSlug: 'oct1-launch-signal',
      xAm: `Apps do not grow because they exist.

They grow because people feel something and tell someone else.

If MenRush sounds like your kind of app, try it:
${CTA}`,
      xPm: `MenRush is for men who want things faster, closer, and more intentional.

If that is you, sign up free:
${CTA}`,
      ig: `If this sounds like your kind of app, you are exactly who it is for.

menrush.com. UK first`,
      bluesky: `MenRush is for men who want less friction, more signal, and a map that actually moves.

${CTA}`,
      tiktok: `Here is exactly who MenRush is for.

Beat: list the target user in direct language, then invite them to sign up free.
CTA: menrush.com.`,
    }),
  );

  // Week 2. nearby energy
  out.push(
    ...dayPosts('2026-08-28', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `See who is near you.

That is the idea MenRush is built around.

Map-first. Local. Immediate.

${CTA}`,
      xPm: `Not another endless grid.

A clearer read on who is actually around when it matters.

${CTA}`,
      ig: `Map-first energy.

Who is nearby.
Who is available.
Who is worth the trip.

menrush.com`,
      bluesky: `Proximity without the noise. Open in the UK.
${CTA}`,
      tiktok: `Hook: Stop swiping strangers across the country. Start with who is near you.

Beat: map energy, local signal.
CTA: sign up free at menrush.com.`,
      reddit: `Title: What does "nearby" need to feel useful (not creepy) in an app for gay men?

Body:
MenRush is built around live proximity for men. Curious what distance, privacy, and intent controls would make you actually turn location on.

It is free if you want to try it: ${CTA}`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-29', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `Tired of chatting for weeks and never meeting?

See who is actually near you.

${CTA}`,
      xPm: `Less chat-for-weeks.
More local signal.
More intent.

${CTA}`,
      ig: `Less chat that goes nowhere.

More men who are actually nearby.

menrush.com`,
      bluesky: `Less chat-for-weeks. More meeting the man down the road.

${CTA}`,
      tiktok: `Hook: The group chat lasted three weeks. Nobody met.

Beat: nearby presence vs endless texting.
CTA: try MenRush free at menrush.com.`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-30', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `We do not invent activity to make the map look busy.

What you see on MenRush is who is really there.

${CTA}`,
      xPm: `Presence first.
No invented numbers.

${CTA}`,
      ig: `Nearby energy.
Honest counts.

If a spot is quiet, it says so.

menrush.com`,
      bluesky: `If a spot is quiet, MenRush shows it as quiet. No padding.

${CTA}`,
      tiktok: `Hook: We do not fake a busy map.

Beat: honest counts and real check-ins.
CTA: menrush.com.`,
      reddit: `Comment angle: In a thread about apps that feel empty or staged.

Copy:
On MenRush we would rather show a quiet spot as quiet than pad it. Curious what makes a nearby map feel trustworthy rather than staged for you.`,
    }),
  );

  out.push(
    ...dayPosts('2026-08-31', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `Friday energy should feel local.

Who is around. Who is free. Who is worth the message.

${CTA}`,
      xPm: `Night proximity without the spam.

Built for men who know what they want.
${CTA}`,
      ig: `Weekend proximity.
Less noise.
More signal.

menrush.com`,
      bluesky: `Local Friday energy, minus the noise.

${CTA}`,
      tiktok: `Hook: Your Friday night app should know who is near you.

Beat: map and presence vibe.
CTA: menrush.com, free to join.`,
    }),
  );

  out.push(
    ...dayPosts('2026-09-01', 2, 'full', {
      templateSlug: 'oct1-trust-discretion',
      xAm: `Discreet does not mean invisible.

It means you control how you show up and still find who is nearby.

${CTA}`,
      xPm: `Adult. Direct.

MenRush is built for men who want presence without the circus.
${CTA}`,
      ig: `Discretion with presence.

See who is near you, on your terms.

menrush.com`,
      bluesky: `Discretion and presence can live in the same app. That is the balance we built for.

${CTA}`,
      tiktok: `Hook: You can be discreet and still find who is nearby.

Beat: control plus proximity.
CTA: menrush.com.`,
      reddit: `Title: How do you balance discretion with actually meeting people nearby?

Body:
MenRush is built for men who want local signal without oversharing. What privacy defaults would you need before turning location on?

${CTA}`,
    }),
  );

  out.push(
    ...dayPosts('2026-09-02', 2, 'full', {
      templateSlug: 'oct1-nearby-rooms',
      xAm: `Soft ask:

When you open MenRush, what do you use first: the map, filters, or the Out tab?

Tell us:
${CTA}`,
      xPm: `We are listening.

What would make nearby more useful for you?
${CTA}`,
      ig: `What do you open first?

Map. Filters. Out.

Tell us in the comments.
menrush.com`,
      bluesky: `Which nearby feature do you reach for first?

${CTA}`,
      tiktok: `Hook: Map, filters, or Out. What do you open first?

Beat: poll style, genuine ask.
CTA: menrush.com.`,
    }),
  );

  out.push(
    ...dayPosts('2026-09-03', 2, 'full', {
      templateSlug: 'oct1-early-premium',
      xAm: `Free to join, free to look around.

Make a profile tonight and see who is close.
${CTA}`,
      xPm: `MenRush is open.

Come and see who is nearby.
${CTA}`,
      ig: `No code needed.

Sign up, set your distance, and see who is around.

menrush.com`,
      bluesky: `Signing up costs nothing. Then the map is yours.

${CTA}`,
      tiktok: `Hook: The easiest way to see who is near you.

Beat: free sign-up, then the map.
CTA: menrush.com.`,
    }),
  );

  return out;
}

/** Weeks 3-launch: outline stubs (expand before approval). */
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
        '2026-09-04',
        '2026-09-05',
        '2026-09-06',
        '2026-09-07',
        '2026-09-08',
        '2026-09-09',
        '2026-09-10',
      ],
      theme: 'Free to join. Make a profile, see who is close. No fake scarcity.',
      redditDates: ['2026-09-05', '2026-09-08'],
    },
    {
      week: 4,
      templateSlug: 'oct1-founder-build',
      dates: [
        '2026-09-11',
        '2026-09-12',
        '2026-09-13',
        '2026-09-14',
        '2026-09-15',
        '2026-09-16',
        '2026-09-17',
      ],
      theme: 'Founder / build in public. Real notes only. no invented metrics. Product questions welcome.',
      redditDates: ['2026-09-13', '2026-09-16'],
    },
    {
      week: 5,
      templateSlug: 'oct1-trust-discretion',
      dates: [
        '2026-09-18',
        '2026-09-19',
        '2026-09-20',
        '2026-09-21',
        '2026-09-22',
        '2026-09-23',
        '2026-09-24',
      ],
      theme:
        'Trust / discretion. Adult & discreet. Do not overclaim location privacy or verification.',
      redditDates: ['2026-09-19', '2026-09-22'],
    },
    {
      week: 6,
      templateSlug: 'oct1-launch-signal',
      dates: [
        '2026-09-25',
        '2026-09-26',
        '2026-09-27',
        '2026-09-28',
      ],
      theme: 'Open in the UK. Nearby, local, free to join. Keep cadence. Do not spam.',
      redditDates: ['2026-09-27'],
    },
    {
      week: 7,
      templateSlug: 'oct1-launch-signal',
      dates: ['2026-09-29', '2026-09-30', '2026-10-01'],
      theme:
        'Open now, UK first. Calm confidence. Free to join. No dates.',
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

export async function seedSocialLaunchPack(): Promise<{
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
  const result = await seedSocialLaunchPack();
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
