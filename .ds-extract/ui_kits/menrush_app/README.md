# MenRush mobile app — UI kit

A hi-fi, click-through React prototype of the core MenRush flow, rendered inside an iPhone frame. Mocked, not production code — the goal is **visual fidelity and reusable components** for further design work, not real auth/messaging/geo.

## What's here

| File | Purpose |
|---|---|
| `index.html` | Entry point. Hosts React/Babel, mounts the iOS device, renders the screen switcher (Live / Discover / Profile / Chat / Premium). |
| `tokens.css` | Re-exports the system-wide `--nn-*` tokens from `../../colors_and_type.css` and adds kit-local utilities (radar pulse, scrollbar hiding). |
| `ios-frame.jsx` | Starter iOS 26 device chrome (status bar, dynamic island, home indicator). Provides `<IOSDevice>`. |
| `components.jsx` | Atom-level components: `PulsingAvatar`, `StatusBadge`, `VerifiedBadge`, `DistancePill`, `TribePill`, `PulseFab`, `Button`, `MessageBubble`, `BottomNav`, `TopBar`, `Scrim`, `Icon`. Exports everything to `window`. |
| `screens.jsx` | Screen-level components: `DiscoverScreen`, `UserCard`, `ProfileDrawer`, `ChatScreen`, `PremiumGate`. Plus the `MR_USERS` mock dataset. |

## What's interactive

In **Live prototype**:

- **Tap a user card** → opens the `ProfileDrawer` bottom sheet
- **Tap OPEN CHAT** inside the drawer → enters the `ChatScreen` for that user
- **Type a message + Enter** in chat → appends to the thread (local state only)
- **Tap the copper sparkle** top-right of the header → opens the `PremiumGate` modal
- **Tap the PulseFab** → toggles your visible/invisible state (changes the radar rings)
- **Tap a radius pill** (1km / 5km / 25km) → filters the user list

In the **Discover / Profile / Chat / Premium** tabs (above the device), each screen is rendered in its static reference state for inspection without interaction.

## What's stubbed

- **No real geo or auth.** `MR_USERS` is a static array of 6 mock profiles.
- **No real photos.** Profile cards show a silhouette icon placeholder. The brief calls for warm masculine editorial photography (see `assets/bg1.png`, `assets/photo*.png`) — production should swap silhouettes for those.
- **No matches / room chat / video call.** Only the four core surfaces (Discover, Profile, Chat, Premium gate) are mocked. The bottom nav has placeholders for Matches and You.
- **No map.** A copper-radar-rings illustration stands in for the live Leaflet map the real app uses on `/discover`. It conveys the same "you in the center, users around you at distance" idea without a tile provider.

## What's mapped to the source codebase

This kit faithfully recreates the component vocabulary in `frontend/src/components/` of the [MenRush repo](https://github.com/Hunter6090-bot/MenRush) — with the copper rebrand applied:

| Repo component | This kit |
|---|---|
| `UserAvatar.tsx` + radar markers in `Discover.tsx` | `PulsingAvatar` |
| `StatusBadge.tsx` | `StatusBadge` |
| `LocationPin.tsx` | radar grid + pin in `DiscoverScreen` |
| `UserCard.tsx` / `ProfileCard.tsx` | `UserCard` |
| `MessageBubble.tsx` | `MessageBubble` |
| `Layout.tsx` (header + bottom nav) | `TopBar` + `BottomNav` |
| `ConversationItem.tsx` | identity strip at top of `ChatScreen` |
| `Discover.tsx` (page) | `DiscoverScreen` |
| *(new)* | `PulseFab`, `ProfileDrawer`, `PremiumGate`, `TribePill` — these surfaces are called for in the rebrand brief but don't yet exist in the legacy repo |

## Adjusting tokens

All color and motion is driven by `--nn-*` vars in `colors_and_type.css`. The JSX components reference them in two ways:

1. **Inline** in the `MR_PALETTE` object at the top of `components.jsx`. **If you change a token in `colors_and_type.css`, also update `MR_PALETTE`** — they're kept in lockstep on purpose so each component can be inspected without chasing CSS vars.
2. **CSS classes** (`.radar-mini`, `nn-fade-in`, `nn-slide-up`) pulled from the tokens CSS.

## Reading order if you're new

1. Open `index.html` in a browser, click around.
2. Read `components.jsx` top-to-bottom — it's a tour of the brand atoms.
3. Read `screens.jsx` — each screen composes atoms into a real surface.
4. Compare against `../../README.md` § "Visual foundations" to see how the choices map to the brand rules.
