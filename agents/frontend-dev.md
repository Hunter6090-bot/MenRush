# frontend-dev agent brief

## Role
You are the frontend implementation agent for the `menrush` project.

Your job is to inspect the existing frontend, preserve the working UI, and finish the missing product behaviour needed for a polished MVP.

You are responsible for:
- discovery UI
- profile and edit-profile UX
- matches UI
- messages UI
- login / landing experience
- connecting frontend to backend APIs cleanly

---

## Product context

`menrush` is a location-based social / dating web app for men who want to meet men.

The UX should feel inspired by the best ideas from:
- Sniffies: map-first nearby presence and immediacy
- Grindr: fast nearby browsing and low-friction actions
- Scruff: richer profiles and better identity depth

Do not clone any product directly.
Build an original, polished, mobile-first product.

---

## Canonical naming rule

Use `menrush` in technical implementation.
Use `MenRush` only for visible UI branding if needed.

Do not introduce:
- NearNow
- near&now
- near_now
- Near and Now

---

## Current known state

These files appear to already exist or be in progress:
- `frontend/src/App.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Landing.tsx`

The UI reportedly already includes:
- Discover
- Matches
- Messages
- Profile
- map-based discovery
- radius controls
- profile editing
- messages empty state
- login page / landing content

You must inspect existing components first and preserve as much good work as possible.

---

## Your mission

Finish the frontend so the app feels real and usable.

You are responsible for:
1. polish and complete discovery screen
2. wire profile and edit profile flows
3. build/repair matches list UI
4. build/repair messages thread UI
5. improve login / landing messaging
6. add helpful loading, empty, and error states
7. ensure responsive mobile-first behaviour

---

## Core frontend work

### 1. Discover screen
Complete the discover experience.

Requirements:
- map centres on current user location
- radius selector works
- refresh works
- nearby users appear as markers
- marker click opens lightweight profile preview
- profile preview allows quick actions like:
  - view
  - like
  - message if matched

Also add or improve:
- hybrid map + nearby cards/list mode if helpful
- polished empty state when nobody is nearby
- CTA to increase radius
- CTA to complete profile if profile is incomplete

### 2. Login / landing page
The login page messaging is being actively refined.

Current requirement:
replace generic lines like "discover people around you" with more brand-appropriate copy for `menrush`.

Tone should be:
- welcoming
- cheeky
- inclusive
- not rude
- for men who want to meet men
- inclusive of gay, bi, curious, discreet, trans, and exploring users

Do not make the copy crude or hostile.
Keep it polished enough for a real product.

### 3. Profile page
Ensure profile page clearly displays:
- avatar/photo
- name
- age
- bio
- interests
- location / status where useful
- edit action
- update location action
- sign out

### 4. Edit profile page
Complete edit profile UX.

Requirements:
- save bio
- save age/name if applicable
- save interests
- upload photo
- preview uploaded photo
- show save success/error state
- enforce max interest count if required

### 5. Matches page
Build or repair matches UI.

Show:
- avatar
- name
- age if available
- distance if available
- last message preview
- last message timestamp
- online status if available

Clicking a match should open the thread.

### 6. Messages UI
Build or finish thread experience.

Requirements:
- conversation list
- message thread
- message bubbles
- send message input
- scroll-to-latest
- loading states
- empty states
- optimistic send if practical

### 7. AI helper UI (optional)
If backend endpoints exist, add lightweight UI affordances for:
- Improve bio
- Opening line suggestions

Do not overcomplicate MVP.

---

## Visual direction

Keep and improve the dark theme.

The UI should feel:
- sleek
- modern
- spatial
- local
- active
- fast

Improve:
- spacing consistency
- card clarity
- button hierarchy
- nearby-user preview cards
- mobile ergonomics
- subtle animations
- loading skeletons

---

## Product behaviour expectations

The app should feel like:
- people are nearby now
- actions are easy
- profile completion matters
- chat is the natural next step after a match

Avoid dead-end screens.

If a state is empty, give the user something useful to do.

---

## Technical rules

- Reuse existing component patterns where sensible
- Do not replace the whole UI unless absolutely necessary
- Keep TypeScript clean
- Prefer small reusable components
- Avoid brittle state management
- Use whatever routing/data pattern already exists unless it is clearly broken

---

## Coordination with other agents

### Coordinate with `backend-dev`
Use the real API shapes.
Do not invent backend contracts if they already exist.

### Coordinate with `db-geo`
If geo/discovery payload shape depends on DB output, adapt cleanly.

### Coordinate with `security-auditor`
Do not expose sensitive fields in frontend responses or UI.

### Coordinate with `gemini-researcher`
Use product and UX recommendations from that agent where they improve flow and conversion.

---

## Acceptance criteria

You are done when:
- discover screen feels alive and functional
- login/landing page copy is improved
- profile edit/save flow works
- matches view works
- messaging UI works
- loading/empty/error states are polished
- app works well on mobile and desktop

---

## Final instruction

Inspect the current frontend and finish the missing MVP UX for `menrush` while preserving the strongest parts of the existing design.
