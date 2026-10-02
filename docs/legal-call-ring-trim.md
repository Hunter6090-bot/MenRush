# Legal brief — MenRush incoming call ring (Nokia Trim)

**Status:** Legal GREEN interim shipped (hook only). **No Trim/Nokia audio in repo.**  
**Entity:** Bronze Apps UK Limited (Co. No. 17249857)  
**Product ask (owner lock):** Classic Trim as the 1:1 incoming-call ring when people ring each other on MenRush.

---

## RED (do not do)

- Scrape Google, free ringtone sites, YouTube, or random MP3 mirrors.
- Bundle any Trim / Nokia Tune / Nokia ringtone file without a **written licence**.
- Ship public UI copy that says “Trim” / “Nokia” for the live ring before licence + Brand sign-off.
- Commission or invent an “inspired by Trim” clone and label it as Trim.

## GREEN interim (what is live now)

| Surface | Behaviour |
| --- | --- |
| In-app WebRTC incoming | **Generic Web Audio oscillator** (`callTones.ts`) — placeholder |
| In-app outgoing | Generic ringback oscillators (unchanged) |
| PWA / closed-app push | OS default notification sound + vibrate |
| Config hook | `/audio/call-ring.trim.mp3` + `/audio/call-ring.trim.cleared.json` |

Code: `frontend/src/lib/callRingAsset.ts`, `callTones.ts`, `frontend/public/sw.js`.  
Folder note: `frontend/public/audio/README.md`.

---

## Rights sketch (for counsel)

Authentic Nokia phone ringtones (including classic Trim / Nokia Tune arrangements and recordings) are **not** free to ship. Composition ancestry (e.g. Tárrega’s *Gran Vals*) does **not** clear Nokia’s arrangement, recording, or sound-mark rights. Treat Trim as **Nokia / HMD-controlled** until counsel says otherwise.

Likely counterparties to approach (in order):

1. **Nokia Corporation — brand / copyright / sound-mark licensing** (not consumer support). Start via [Nokia contact / patent & IP channels](https://www.nokia.com/contact-us/) and request **ringtone / sound trademark licence for a third-party consumer app (MenRush)**.
2. **HMD Global / HMD Sound** if counsel confirms they control the shipping phone ringtone pack for the exact Trim asset Al wants.
3. If a named sound designer (e.g. historical Nokia ringtone authors) is identified for the exact file Al specifies, route **through Nokia/HMD**, not a side deal that skips brand ownership.

Ask counsel to confirm: territory (at least UK + launch markets), term, media (in-app WebRTC + PWA notification), formats (mp3/ogg), sublicence to users’ devices, and whether the **name “Trim” / “Nokia”** may appear in Settings or marketing.

---

## Next steps for Al (owner)

**Path A — Authentic Trim (preferred product lock)**

1. Instruct counsel for Bronze Apps UK Limited to request a **written licence** from Nokia (and HMD if required) for app + PWA use of the exact Trim ringtone Al identifies.
2. On written clearance: drop `frontend/public/audio/call-ring.trim.mp3` + `call-ring.trim.cleared.json` with `licenseRef`.
3. Brand listens on device (in-app ring + one Android push if possible) and **signs** before any public “Trim” claim.
4. Merge as a tiny follow-up PR; no UI copy change until Brand signs.

**Path B — Royalty-clear original (fallback if Nokia declines / cost)**

1. Commission or buy a **royalty-clear** incoming ring (stock licence that allows app redistribution, or work-for-hire).
2. **Do not** brand it as Trim/Nokia in UI or docs.
3. Same drop path (`call-ring.trim.*` may be renamed via manifest `src` if Brand prefers a neutral filename).
4. Brand signs the audio; Legal files the licence PDF.

**Until A or B:** keep shipping the generic oscillator. Hook stays ready.

---

## Brand glance gate

PR may merge with hook + docs. **Brand only reviews a clean licensed file later.** Do not ping for Trim QA until the cleared MP3 exists in-repo.
