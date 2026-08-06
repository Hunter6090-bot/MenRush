# Discovery 2.0 — Nearby map screenshots

Permanent verification artifacts for [PR #70](https://github.com/Hunter6090-bot/MenRush/pull/70) / issue #67
(unify Nearby into one map with People/Hot Spots layers). Captured against the
deterministic `E2E Test Hot Spot` fixture (`backend/scripts/seed-test-users.ts`,
`seedTestHotSpot()`) via Playwright, not hand-taken — reproducible by re-running
the capture steps in that PR's description against a local dev server.

- `discover-desktop-layers.png` — desktop Nearby map, People + Hot Spots layer
  toggles both on (default), light theme basemap.
- `discover-desktop-hotspot-sheet.png` — in-map Hot Spot sheet open on desktop
  (check-in / anonymous / safety tips / Free rounded-count copy).
- `discover-mobile-layers.png` — mobile Nearby map with the same layer toggles.
- `discover-mobile-more-menu.png` — mobile "More" sheet showing Events and
  Settings only — Hot Spots is intentionally absent (#67 nav removal).
