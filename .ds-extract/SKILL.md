---
name: menrush-design
description: Use this skill to generate well-branded interfaces and assets for MenRush — a real-time, location-first social platform for men. Contains essential design guidelines (copper-on-near-black palette, Trajan-style display type, radar pulse motion vocabulary), brand assets (medallion logo, app icons, editorial photography), and a complete UI kit (Discover, Profile, Chat, Premium gate) for prototyping in HTML, React mocks, decks, or production frontend work.
user-invocable: true
---

# MenRush — design skill

MenRush is a hookup-first proximity app: "Pulse for now. Match for later." The visual identity is dark, masculine, premium — copper/bronze on near-black, Trajan-style display caps, deep warm shadows, and the signature concentric-radar pulse motif on anything "live nearby".

## How to use this skill

1. **Read `README.md`** in this skill first — it has the full brand brief: tone of voice, visual foundations, iconography rules, what to do, what to avoid.
2. **Read `colors_and_type.css`** for every token (`--nn-bg`, `--nn-copper`, `--nn-text`, type scale, motion, shadows). Don't hardcode hex values — reference the vars.
3. **Browse `preview/`** for tight specimen cards of every system primitive (color, type, spacing, components, motion).
4. **Use `ui_kits/menrush_app/`** as the source of truth for React component implementations. `components.jsx` has small atoms; `screens.jsx` has full surfaces. They mirror the live repo's vocabulary (`PulsingAvatar`, `MessageBubble`, `PulseFab`, etc).
5. **Pull assets from `assets/`** rather than re-rendering. The bronze medallion, app icons, social glyphs, and editorial photography are all there.

## When generating output

- **For visual artifacts** (mocks, slides, throwaway HTML prototypes): copy the relevant assets and tokens out into a self-contained file. Always reference the medallion (`assets/medallion-480.png` or `medallion-reverse.png`) for any hero, splash, or premium-gate background — at 16–30% opacity behind content.
- **For production code** (working in the real MenRush frontend): the tokens here override the legacy NearNow blue/coral palette still committed in `frontend/tailwind.config.js`. Mirror the `nn:` namespace with these values; reuse the components already in `frontend/src/components/` rather than inventing new ones.
- **For copy**: terse, present-tense, sentence case. No emoji, no exclamation points, no fake scarcity. "See who's near you right now." Not "Discover amazing men in your area today!".

## When the user invokes this skill with no other guidance

Ask what they want to build:

- "A new screen / surface inside the MenRush app?" → mock it with the UI kit components.
- "A marketing landing / hero?" → use the medallion + Inter 900 all-caps display + warm editorial photography.
- "A deck or slide?" → use the bronze coin as the visual anchor and Inter 900 all-caps for headlines.
- "An ad creative or social post?" → copper-on-black, single direct line of copy, no decoration.

Then ask 2–3 sharpening questions:

- Tone — is this a paywall (warmer / aspirational) or a utility surface (functional / dense)?
- Audience — existing user, new user, or marketing prospect?
- Constraints — platform (iOS / Android / web), aspect ratio, dark-only or also light?
  *(For the record: MenRush has **no light mode**. If someone asks for one, push back — it's against the brief.)*

## Hard rules to enforce

1. **Background is never pure white or pure black.** Use `--nn-bg` (`#0D0A06`).
2. **Copper does all the accent work.** No purple, no pink, no neon mint, no fire-engine red.
3. **No emoji. No hearts.** Affection signals use copper pulse rings.
4. **No swipe metaphors.** This isn't Tinder/Grindr.
5. **No fake scarcity on premium gates.** No countdown timers, no "only X spots left".
6. **The verified badge is free** — it's a trust signal, never gated behind premium.
7. **Photography is warm, dim, masculine, real.** Not stock "diverse friends in a park".
8. **Motion: 240ms `cubic-bezier(0.16, 1, 0.3, 1)`, fade + slide-up only.** No bounces, no overshoot. The radar pulse is reserved for "active now / nearby" signals.

## Files in this skill

```
README.md              ← full brand brief (read first)
SKILL.md               ← this file
colors_and_type.css    ← all design tokens (CSS vars), import in every artifact
assets/                ← logos, icons, photography
preview/               ← specimen cards (one concept per HTML file)
ui_kits/menrush_app/   ← React click-through prototype + reusable JSX components
```

## Source repo

Live codebase to defer to for component patterns and API surfaces:
**<https://github.com/Hunter6090-bot/MenRush>** — `frontend/src/` is the relevant subtree. Treat the existing `tailwind.config.js` colors as legacy; use the copper tokens from this skill instead.
