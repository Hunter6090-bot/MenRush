# Call ring audio (Legal GREEN interim)

**No Trim / Nokia MP3 is shipped in this folder.**

## Placeholder in production today

| Path | What plays |
| --- | --- |
| In-app incoming (`callStatus === 'ringing'`) | Existing **generic Web Audio oscillator** in `frontend/src/lib/callTones.ts` (C-major arpeggio). Not Trim. Not Nokia-branded. |
| In-app outgoing | Existing generic ringback oscillators (UK-style 400/450 Hz). |
| PWA / background push | OS default notification sound (`silent: false`). Custom `sound` only after clearance. |

## Future cleared asset (do not invent / scrape)

Once Bronze Apps UK Limited has a **written Nokia (or HMD) licence** — or Brand signs a royalty-clear original that is **not** marketed as Nokia/Trim without licence — drop:

1. `call-ring.trim.mp3` — the licensed file (or rename via manifest `src`)
2. `call-ring.trim.cleared.json` — Brand/Legal marker, e.g.

```json
{
  "cleared": true,
  "src": "/audio/call-ring.trim.mp3",
  "licenseRef": "Nokia written licence <ref> / counsel file"
}
```

Hooks already wired:

- In-app: `createCallTone('incoming')` → asset when marker cleared, else generic
- PWA SW: `resolveCallNotificationSound()` → Notification `sound` when marker cleared

## Brand glance

Brand listens to the **cleared file** before claiming live. Do **not** put “Trim” / “Nokia tune” in public UI copy until Brand signs the audio.

See `docs/legal-call-ring-trim.md`.
