## Summary

Step 1 of the Pete 6 Oct 2026 Claude Design redesign (`MENRUSH PHONE — 9 STATES`), updated for the **home Map|List bottom-tab toggle**.

### Step 0
- Feature map: `docs/redesign-2026-10/feature-map.md`

### Step 1
- **Bottom tabs:** **Home toggle (Map|List)** · Chat · Rooms · Out · You
  - When home is **map**, first tab shows **List** (grid icon) → tap switches to member list
  - When home is **list**, first tab shows **Map** (pin icon) → tap switches to map
  - Preference persisted (`menrush_home_view`, default **map**), synced with Nearby map|grid storage
- **Out** hub (`/out`) chips All / Sauna / Bar / Event / Community; old routes still reachable
- **Map** top pills: Radius / Filters / Search; empty-radius Widen CTA
- **Pin sheet:** Chat / Album / More; Match/Pulse/Report/Block in More
- **Chat** chips: All / Matches / Unread
- In-map phone Map/Grid toggle removed (duplicated by home tab); desktop Map/Grid kept; grid features (#312 rim, radius, Load more) preserved
- Rebased onto `main` including **#315** brand placeholder avatar (`025ffdb`)
- Cuts: NEW badges + mood text on cards; Ready to meet stays removed

### Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [x] vitest (homeView + nav + Layout + ProfileDrawer + smoke)
- [ ] Manual 390×844: Map home (tab=List), List home (tab=Map), pin sheet, More, empty radius
- [ ] Do not merge / deploy / ping until Product review
