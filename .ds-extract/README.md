# MenRush — Design System

> **Pulse for now. Match for later.**
> A real-time, location-first social platform for men who want to meet other men nearby.

This folder is the design system for MenRush — a working library of tokens, type, components, and brand assets that lets a designer or engineer build new screens, decks, ads, or prototypes that feel unmistakably *MenRush* without reinventing the visual vocabulary every time.

---

## What MenRush is

MenRush is a hookup-first, real-time discovery app for men meeting men nearby. The core mechanic is **proximity-as-presence**: users share GPS, the app surfaces who is *actually within walking distance and active right now* (default 5 km radius, configurable). There is no swiping queue, no "wait three days to match" — the product's promise is **"no waiting"**.

**Core product surfaces the system has to cover:**

| Surface | Purpose |
|---|---|
| Discovery grid | Live nearby users, sorted by distance + activity |
| Profile card + drawer | Tap-through profile with photos, tribes, mood, distance |
| Conversation / message bubbles | 1:1 chat, copper-on-bronze for "mine", dark card for "theirs" |
| Room chat | Group chat tied to a location or tribe |
| Pulse FAB | The signature copper radar button — sets you visible/active |
| Mood + Tribe pickers | "What are you here for" + identity tags |
| Status badges | Online / Active now / Last seen, plus the verified copper checkmark |
| Video call modal | In-app video, dark chrome, copper accents |
| Premium gates | See-who-liked-you, boost, expanded radius, incognito, advanced filters |

The audience is adult men, and the visual treatment reflects that — confident, direct, masculine. Not corporate. Not playful. Not pastel.

---

## Sources used to build this system

This system was assembled from materials the user attached. Anyone iterating on it should go back to these sources for ground truth:

- **GitHub — `Hunter6090-bot/MenRush`** &nbsp;<https://github.com/Hunter6090-bot/MenRush>
  Full-stack codebase. The `frontend/` folder contains the React + Tailwind app whose components define the in-house vocabulary (`UserCard`, `ProfileCard`, `MessageBubble`, `LocationPin`, `StatusBadge`, `ConversationItem`, `UserAvatar`, `Layout`). Read `frontend/src/components/` and `frontend/src/pages/Discover.tsx` to understand the existing patterns. The repo's `tailwind.config.js` defines the Tailwind `nn:` namespace this system mirrors.
  > Note: the repo's *current* committed palette is still the legacy NearNow blue/coral (`#4F8CFF` / `#FF6B6B`). The brief explicitly **overrides** this to copper/bronze. Treat the repo as a source of **components and conventions**, not of color tokens.
- **Local `public/` folder** &nbsp;(`public/brand/`, `public/images/`, `public/bg*.png`, `public/logo.png`)
  Brand assets: the bronze medallion (obverse + reverse), 16/32/.../1024 PNG icons, social glyphs, hero photography. Copied into `assets/` here so designs can reference them.
- **The brief itself** — the rebrand direction document that defines the copper palette, motion vocabulary, premium-gate rules, and tone-of-voice rules. Treated as the source of truth for visual tokens where it conflicts with the repo.

If you want to do a better job iterating on MenRush, explore the GitHub repo above directly — it has more screens (Discover map, Profile, Messaging, Matches, Login, Register) and full SQL/API context that this design system doesn't reproduce.

---

## Index — what's in this folder

```
MenRush-Design-System/
├── README.md                 ← you are here
├── SKILL.md                  ← Agent Skill manifest (for Claude Code use)
├── colors_and_type.css       ← CSS vars: every --nn-* token, type styles, motion keyframes
│
├── assets/                   ← logos, icons, brand photography
│   ├── medallion-480.png     ← primary bronze coin (obverse: profiles + "MENRUSH")
│   ├── medallion-380.png     ← smaller variant
│   ├── medallion-reverse.png ← reverse coin (concentric copper rings = radar motif)
│   ├── icon-1024.png .. 32   ← app icon set, copper-on-black
│   ├── coin-back-menrush.jpg ← reverse coin, full-res, for backgrounds
│   ├── bg1.png, bg2.png      ← editorial brand photography (leather / cigar / nightlife)
│   ├── photo1.png, photo2.png← lifestyle photography
│   ├── screen-3.png          ← legacy NearNow medallion (kept for reference only)
│   ├── social-x.png          ← X social glyph
│   └── social-linkedin.png   ← LinkedIn social glyph
│
├── preview/                  ← Design-System tab cards (~700×var px each)
│   ├── color-*.html          ← brand palette, surfaces, semantics
│   ├── type-*.html           ← display / heading / body / mono / overline specimens
│   ├── shadow-*.html         ← elevation & glow systems
│   ├── radius-*.html         ← corner radius scale
│   ├── spacing-*.html        ← spacing scale
│   ├── motion-radar.html     ← the signature pulse animation
│   ├── component-*.html      ← buttons, badges, avatar, message bubble, profile card, pulse FAB, tribe pills, premium gate
│   └── brand-*.html          ← logo, medallion, photography mood
│
└── ui_kits/
    └── menrush_app/          ← Hi-fi click-through prototype of the MenRush mobile app
        ├── README.md         ← what's mocked, what's stubbed
        ├── index.html        ← grouped screen switcher (App · Rooms · Auth · Verify · Premium · Modals)
        ├── tokens.css        ← imported by every component
        ├── ios-frame.jsx     ← device chrome (starter)
        ├── components.jsx    ← atoms: Avatar, Button, StatusBadge, PulseFab, MessageBubble, BottomNav, TopBar, Scrim, Icon…
        ├── screens.jsx       ← Discover · ProfileDrawer · ChatScreen · UserCard
        ├── modals.jsx        ← unified PremiumGate (5 variants) · BoostConfirmModal · VideoCallModal · MoodTribeSheet · IncognitoScreen
        ├── auth.jsx          ← Login · Register · Forgot · Reset · AuthShell (photo slideshow)
        ├── verify.jsx        ← VerifyFlow: intro · capture · selfie · pending · verified
        └── rooms.jsx         ← RoomsListScreen · RoomChatScreen
```

---

## Content fundamentals

The voice is **terse, present-tense, masculine, unfiltered**. Sentences are short. No marketing fluff, no hedging, no qualifiers, no exclamation points.

### Rules

- **Person.** Address the user as **"you"**. Never "we", never "your account", never third-person.
- **Tense.** Present, active, indicative. *"See who's near you."* Not *"Discover men in your area."*
- **Casing.** Sentence case for everything except the wordmark and section openers. The wordmark **MENRUSH** is always all-caps (matches the embossed coin lettering). Section openers in marketing use **ALL CAPS + tracked Cinzel** ("PULSE FOR NOW.") for editorial weight.
- **Punctuation.** Periods are fine. Question marks for prompts. **No exclamation points.** No em-dashes-as-pause-decoration. No emoji.
- **Numbers.** Always digits. *"3 miles", "3 men nearby", "12 active"* — never spelled out.
- **Verbs over nouns.** *"Pulse"*, *"Spot"*, *"Open chat"* over *"Notifications"*, *"Visibility"*, *"Messages center"*.

### Specific examples (use these as your tone tuning fork)

| Surface | Copy |
|---|---|
| Tagline | **Pulse for now. Match for later.** |
| Hero | **See who's near you right now.** |
| Hero secondary | No waiting. No swiping. Just men nearby. |
| Empty Discover | No one nearby. Try a wider radius. |
| Pulse FAB tooltip | Go visible. 3 mile radius. |
| Verified badge | ID verified. |
| Online status | Active now / Last seen 12m ago |
| Premium gate (See likes) | 3 men liked you. See them. |
| Premium gate CTA | Unlock — £9.99/mo |
| Boost prompt | Be at the top for 30 minutes. |
| First message hint | Say something direct. |
| Logout | Sign out. |
| Error (location denied) | Allow location to see who's nearby. |
| Block confirm | Block this user? They won't see you again. |

### What to avoid

- ❌ "Hey! 👋 Discover amazing guys in your area today!"
- ❌ "Don't miss out — only 2 hours left to boost!" (no fake scarcity)
- ❌ "Find your perfect match." (this is not a matching app first)
- ❌ "Welcome back, friend." (too soft)
- ❌ Words: *journey, vibe-check, slay, baddie, energy, queen, hunny, sis* — wrong register

### Words MenRush uses

**Pulse** (the act of going visible), **Spot** (a person nearby), **Tribe** (identity tag — bear, jock, daddy, twink, leather, otter…), **Mood** (what you're here for — chat, drinks, date, NSA), **Nearby** (the universal noun for the discovery surface), **Match** (mutual like that opens chat), **Visible** / **Invisible** (incognito state), **Active now**, **In your radius**.

---

## Visual foundations

### The big idea

MenRush looks like **a copper medallion lit in a dim leather bar**. Two metaphors are doing all the work:

1. **The coin.** The brand mark is a literal bronze relief medallion — two men's profiles in Roman-frieze style, surrounded by a Trajan-caps "MENRUSH" inscription. The visual language inherits that: warm, sculptural, classical, weighty. Not chromy. Not flat-design.
2. **The radar.** The reverse of that coin is **three concentric copper rings** around a central dot. That's not a coincidence — it's the radar-pulse motif that animates on every "active now / nearby / connect now" affordance in the product. The brand mark and the core interaction are *the same shape*.

Everything below serves those two metaphors.

### Color

- **Foundation is near-black, never pure black, never blue-black.** `#0D0A06` has a warm brown undertone. Pure `#000` looks dead next to copper; the brown undertone makes the copper sing.
- **Surfaces stack warm.** Card `#1E1508` → elevated `#2A1C0A` → border `#3D2B0E`. Each step adds a hint more bronze. Never use white-with-low-opacity for elevation — it cools the palette and breaks the bronze illusion.
- **Copper does 90% of the accent work.** `#C4832A` for CTAs, active tab state, pulse rings, verified badge, premium copy. Rust `#8B4513` is a secondary — use it for borders, dividers, depressed states, secondary buttons. **Together they're enough.** Resist adding a third accent.
- **Text is warm cream, not white.** `#F0E0C0` for primary, `#A89070` for muted. Pure white at full opacity feels clinical against the warm palette.
- **Status colors are muted and earthy.** Online is `#6FA85A` (deep mossy green, not neon mint). Danger is `#B0432E` (burnt brick, not fire-engine red). They should look like they were cast from the same alloy as everything else.
- **No gradients across hues.** A subtle copper→rust gradient on a CTA hover is fine. A purple→pink gradient is a deal-breaker. The brief is explicit: *no gradients-on-gradients on premium gates.*

### Typography

- **Single face: Inter** (Google Fonts, weights 300–900). The brand uses **one font**. Hierarchy comes from **weight, size, and letter-spacing**, never from a second face. This matches what's already loaded in `frontend/index.html` and keeps the visual system tight.
- **Display = Inter 900 (black), all-caps, wide tracking** (0.06–0.10em). Used for the wordmark, hero copy, section openers, premium-gate headlines. The weight + tracking does the work that a chiseled-serif face would do elsewhere.
- **UI = Inter weights 400–800**, sentence case, normal or slightly-negative tracking (`-0.01em` on H1/H2). Body 400, emphasis 600, page titles 700–800, hero 900.
- **Tracking rhythm.** Display caps = generous (≥ 0.06em). Body = normal. Overline / button caps = `0.18em`.
- **Weight floor.** Don't use 300 below 16px — it disappears on the warm background.
- **No script fonts. No condensed sans. No emoji glyphs as type. No second face.**

### Backgrounds

- **Primary background is flat `--nn-bg`.** Not gradient. Not patterned. The product is content-dense — let the photography and cards carry visual weight.
- **Hero / splash / paywall hero may use the medallion reverse** (`coin-back-menrush.jpg`) at 30–40% opacity, centered, behind content. It's the only "decorative texture" allowed.
- **Editorial photography is warm, dim, and confident.** Leather, denim, sweat, low ambient light, occasional cigar smoke, occasional crowd shots from gay-village nightlife. Always warm-temp graded (orange highlights, deep shadow). Never cool-blue, never grainy black-and-white indie, never stock-photo "diverse smiling friends in a park".
- **Subjects are adult men in real settings.** Not illustrated. Not abstract. The photography earns the masculine positioning.

### Motion

- **Default arrival: 240ms `cubic-bezier(0.16, 1, 0.3, 1)`** — assertive but not bouncy. Components fade-in (6px) on mount, drawers slide-up (16px). No spring physics, no overshoot.
- **The signature animation is the radar pulse.** Three concentric copper rings, each scaling 1→3.5 over 2.4s, with `opacity 0.6→0`, staggered 0.8s. Used on: the PulseFab, active-now avatars, location pins, empty-state "searching nearby" indicators. **Use it sparingly** — it loses meaning if everything pulses.
- **Hover = brighten, not lift.** Buttons go `#C4832A → #E0A14A` on hover. Cards may lift `-translate-y-1` and intensify their shadow (`--nn-shadow-card-hover`) — that's the maximum acceptable lift.
- **Press = scale 0.95.** No color change on press.
- **No bounces, no jiggles, no decorative micro-interactions.** This is not a Duolingo owl.

### Borders, shadows, corners

- **Borders are warm, low-contrast hairlines.** `1px solid --nn-border` (`#3D2B0E`). On copper-emphasized surfaces, `1px solid rgba(196,131,42, 0.3)`. Never `rgba(255,255,255, x)` — that's the legacy NearNow look.
- **Shadows are deep and warm, never cast in cool blue.** `--nn-shadow-card` is `0 4px 24px rgba(0,0,0,0.55)` — almost pure black, generous radius. Glow effects on copper use `rgba(196,131,42, 0.35)` and only fire on focus/active/hover.
- **Inner shadows for inset depth.** A `inset 0 1px 0 rgba(255,200,130, 0.06)` on cards gives a "polished top edge" feel — like light hitting the rim of bronze. Subtle.
- **Corners.** Default card radius 16px. Modal/drawer 24px. Pills/badges full-round. Avatar full-round always. Sharp 0px corners are reserved for the section-divider hairlines and inscription-style headings.
- **Capsules > rounded rectangles for chips/tags.** Tribe pills, mood pills, distance badges are all full-round.

### Layout

- **Mobile-first; everything is sized for thumb.** Hit targets ≥44px. Bottom nav ≥64px. Floating PulseFab is 64×64 with a 16px margin from the safe-area bottom.
- **Card grid on Discover** is `grid-cols-2 sm:grid-cols-3 gap-3`. Density matters — empty space reads as "nobody's here", which is the wrong message.
- **The PulseFab is the only persistent floating control.** No FAB stacks. No expandable speed-dials.
- **Bottom nav with 4 tabs**: Discover / Matches / Messages / Profile. Active = copper + scale-110 icon + filled state.
- **Safe-area aware** (iOS notch / Android gesture bar) — every fixed/floating element respects `env(safe-area-inset-*)`.

### Transparency & blur

- **Map controls use `bg-[var(--nn-card)]/85` + `backdrop-blur-xl`.** That's the one place blur is OK.
- **Modal scrims are 60% black, not blurred.** The content beneath needs to disappear, not soften.
- **Avatars on the map** sit on a solid `--nn-card` background with a 2px copper border + radar pulse — never transparent.

### Imagery — color & treatment

- **Warm grade across all editorial.** Orange highlights (≈ `#C4832A`), deep dark shadows. Avoid magenta, teal, anything cool.
- **No black-and-white** unless it's the rare archival-style brand moment.
- **Light grain is acceptable** on hero photography — but never the heavy 35mm-film-emulation look.
- **Real men. Real settings. Real grit.** Sweat, beards, body hair, leather, bars at night — these are *features*. Not airbrushed, not "creative-class loft" lighting.

### Fixed elements

- **Top header** (mobile + web): 56px, sticky, `bg-[var(--nn-bg)]/85 + backdrop-blur-xl`, hairline bottom border.
- **Bottom nav** (mobile only): 64px, fixed, same chrome as header but top border.
- **PulseFab**: fixed bottom-right above the bottom nav, 64×64, copper, glowing.

---

## Iconography

> **TL;DR** — MenRush does **not** use emoji, does **not** use illustrated icons, and uses **stroke icons sparingly**. The most important "icon" in the entire system is the radar pulse — copper rings around a dot. Most other affordances are typographic or photographic, not iconic.

### What the repo uses (and what we adopt)

The repo's `frontend/src/components/Layout.tsx` hand-rolls **inline SVG icons** in a single line-art style: 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`, rounded line-caps and -joins. The set is small and product-specific — Compass, Heart, Chat, Person, Logout, Pin, Refresh, Filter, Close, Radar, Chevron.

We keep that style as the in-house convention:

> **House icon style** — line, 1.5–2px stroke, 24×24, `currentColor`, rounded caps, no fills (filled variant only for "active state" of nav). Inherits text color so a copper-tinted nav item gets copper icons automatically.

### Recommended icon source

The repo doesn't ship an icon font or sprite. Rather than hand-rolling every glyph, the design system recommends **Lucide** (<https://lucide.dev>) as a CDN-backed source — it matches the in-house stroke style exactly (2px, rounded caps, 24×24, `currentColor`) and is what `Layout.tsx`'s icons look almost identical to anyway.

> ⚠️ **Substitution flag** — Lucide was not in the original repo. Designers using it should still match the in-house style: 2px stroke, rounded joins, no fills. Mocks in `ui_kits/menrush_app/` use inline SVGs copied from Lucide for offline use, not the CDN.

### When to use the heart icon — **DON'T**

The legacy NearNow design used a coral heart for "like" — the brief is explicit that hearts are **out**. Affection signals are conveyed by **copper pulse rings around the avatar** or a **filled copper dot** in the corner. The heart icon is retired.

### Emoji

**No emoji anywhere.** Not in UI, not in marketing, not in pushes, not in error states. The pin icon next to "1.3 mi away" is a 12px SVG pin, never the 📍 emoji (the legacy `UserCard.tsx` had `📍 5km` — that's been replaced).

### Unicode glyphs

Allowed only for **invisible/incognito** state (using `◐` or `◯`) when an SVG would be overkill, and for the **·** middle-dot separator in metadata strings (`"23 · 2.1km · Active now"`).

### Logos

- **Primary** — the bronze coin medallion (`assets/medallion-480.png`). Always on near-black or dark photography. Never on white.
- **Wordmark only** — `MENRUSH` set in Inter 900, all-caps, copper or cream, tracked +0.1em. Use when the coin is too small to read (favicons aside) or where the relief texture would muddy.
- **App icon** — `assets/icon-512.png` (and smaller) — a tighter, app-icon-cropped coin reverse, all copper rings on near-black. This is the asset you'd ship to the App Store.
- **Reverse coin** (`assets/medallion-reverse.png`) — pure concentric-ring motif. Use as a low-opacity background on splash, hero, and premium-gate hero. Also the reference for any animated radar-pulse implementation.

---

## How to use this system

1. **Drop `colors_and_type.css` into your project** and reference the `--nn-*` variables, or mirror them in `tailwind.config.js` under `theme.extend.colors.nn` and `theme.extend.fontFamily` (the repo already does this for the legacy palette — replace the values with the copper tokens here).
2. **Copy assets** from `assets/` rather than linking the GitHub URLs — those URLs change.
3. **For new screens**, start by looking at the closest matching `preview/component-*.html` card and `ui_kits/menrush_app/*.jsx` component. The component vocabulary is the contract.
4. **For new copy**, run it through the "Content fundamentals" examples above. If it could be in a Duolingo notification or a Hinge prompt, it's wrong.
5. **For new visuals**, the test is: *would this look natural cast in bronze?* If yes, ship it. If it's flat, neon, pastel, or playful — reconsider.

---

## Open caveats

- The repo's committed Tailwind config and components still use the **legacy NearNow blue/coral palette**. This design system intentionally *replaces* those tokens with the copper system per the rebrand brief. If you're working in the live codebase, you'll need to migrate `bg-nn-blue` → `bg-nn-copper`, `bg-nn-bg #0F1115` → `#0D0A06`, etc. The components themselves (layout, structure, sizing) are kept.
- The hero photography (`bg1.png`, `bg2.png`) skews toward a specific leather/cigar register. Production should commission a broader range of editorial that hits the same warm-grade, masculine-confident note without being thematically narrow.
