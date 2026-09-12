# Adult assurance — Brand / Zoul UI lock (#97)

**Al cleared MERGE WHEN READY.** Product squash-merges after Brand final sign. Do not self-merge.

## Chrome (live Register)

- Shell: `PublicAuthShell` + `publicStyles`
- Night `#0D0A06` · Card `#1E1508` · Copper `#C4832A` (hover `#E0A14A`) · Cream `#F0E0C0`
- Font: Inter (globals)
- Logo: official medallion via `BrandMark` → `frontend/public/brand/menrush-logo.png` (synced sizes). No invented mark. No typed MENRUSH.

## Flow

MenRush screens only: intro · optional ID upsell · verified success · underage.
Capture = Veriff-hosted (`sessionUrl` / SDK). No custom camera UI.

## Logo (Brand glance)

- Prefer `BrandMark` medallion alone (PNG already has MENRUSH inscribed).
- If a typed wordmark ever sits beside the mark, it must be **MenRush** (title case), never **MENRUSH** as type.

## Copy

See `docs/adult-assurance-face-copy.md`. Al preferred mock (Quick selfie. / You are through.). No em dashes on face (periods only: "Confirms you're 18+. Takes about ten seconds."). Age-gate ≠ Verified. Face storage line: MenRush never keeps copies of your ID. No OSA / all-verified.

## Background (Al lock)

- Omit `backgroundImage` on age-check / upsell / underage so `RandomBackground` picks (changes on refresh / navigation).
- Brighter: `AUTH_ASSURANCE_BACKGROUND_OPACITY` ~0.52, `AUTH_ASSURANCE_GRADIENT` lighter, brightness ~1.08.
