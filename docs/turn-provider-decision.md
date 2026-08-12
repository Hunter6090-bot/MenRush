# TURN provider decision — #73 remote video black

**Status:** Draft. Root cause and ICE-gathering evidence below are grounded in
commits already in this repo (cited inline — verify with `git show <sha>`).
The provider cost comparison is **new analysis written today**, not recovered
from issue #73's comment thread — GitHub wasn't authorized in the session
that wrote this doc, so the original "full evidence and provider comparison"
referenced in `fe68e25`'s commit message (posted as a #73 comment) could not
be read. Re-run that comparison once GitHub access is available, and diff it
against this one before treating either as final.

---

## 1. What's confirmed (grounded in repo history)

- `fe68e25` — *fix(calls): warn loudly when production has no real TURN
  provider (#73)* (also PR #75, draft). Root cause: `getIceServers()` in
  [`backend/src/services/webrtc.service.ts`](../backend/src/services/webrtc.service.ts)
  has always fallen through to Metered's free public Open Relay TURN service,
  using the static secret published verbatim in Metered's own quickstart
  docs — shared across every app that copy-pasted that example, unauthenticated
  per-app, no capacity guarantee.
- `005b2c8` — *docs: update #73 ledger entry with real ICE-gathering
  evidence* (on the `docs/menrush-2.0-vision` branch,
  `docs/product/MENRUSH_2.0.md`): a real ICE-gathering test (no mocks)
  produced **0 relay candidates** against the current Open Relay config, and
  **0 candidates of any kind** with `iceTransportPolicy: 'relay'` forced.
- Signalling itself (offer/answer/ICE exchange, Socket.IO `call:*` handlers)
  is not implicated — the call reaches `connected` regardless, because STUN
  alone succeeds. The failure is specifically: no working relay for peers
  that need one (carrier-grade NAT, symmetric NAT, iOS Safari's mDNS-only
  local candidates) — media never arrives, remote video stays black, local
  preview is unaffected since it never touches the network.
- The code already fully supports a real provider: `TURN_URL` + `TURN_SECRET`
  (TURN-REST HMAC, via `createTurnRestCredentials`) or `TURN_URL` +
  `TURN_USERNAME` + `TURN_CREDENTIAL` (long-lived creds). Confirmed by
  reading `webrtc.service.ts` directly — no provider has ever been
  configured, the fallback was silent until `fe68e25` added a loud
  console warning.
- `TURN_URL`/`TURN_SECRET`/`TURN_USERNAME`/`TURN_CREDENTIAL` are documented
  in `.env.example`, `backend/.env.example`, and `CLAUDE.md`'s env var table
  (the last of these added by `fe68e25`).

**Not yet proven:** the ICE-gathering test above ran from a dev/sandbox
environment, not a real user network or Railway's own network. Confirming it
holds on two real, different-network devices (Step 3 below) is the one step
between this diagnosis and spending money on a provider.

## 2. Provider comparison (new analysis, priced today)

| Provider | Price | Free allowance | UK/EU edge | Auth model vs. our code |
|---|---|---|---|---|
| **Cloudflare Realtime (Calls) TURN/SFU** | $0.05/GB egress | 1,000 GB/mo, shared across SFU+TURN | Strong — Cloudflare's anycast network, good for a UK-first audience | REST credential issuing — needs a quick check it matches `createTurnRestCredentials`'s TURN-REST HMAC shape before committing |
| **Twilio Network Traversal Service** | $0.40/GB (US West) up to $0.80/GB (Sydney); STUN free, billed only when relay is used | No free tier found; low absolute cost at MenRush's current scale | EU edge (Ireland/Frankfurt-adjacent per Twilio docs) — EU-specific rate not confirmed | TURN-REST HMAC — same model `createTurnRestCredentials` already implements; likely a pure env-var swap |

Sources checked today: [Cloudflare Realtime SFU/TURN pricing](https://developers.cloudflare.com/realtime/sfu/pricing), [Twilio Network Traversal Service pricing](https://www.twilio.com/en-us/stun-turn/pricing).

Only these two were priced — Metered's paid tier and Xirsys weren't re-verified
today. If the original #73 comment thread compared more providers, treat that
as the more complete source once it's readable.

**Recommendation:** Cloudflare first (cheapest, best UK/EU latency, free tier
covers the whole validation phase), Twilio as fallback if Cloudflare's REST
auth handshake turns out not to match `createTurnRestCredentials` cleanly —
Twilio's auth model is the closer match to the code as it exists today, so
it's the lower-integration-risk option if Cloudflare stalls.

## 3. Runbook

### Step 1 — Two-device validation (do this first, costs nothing)

Confirm the sandbox finding holds on a real network before spending anything.

1. Two devices, two different networks (wifi + mobile data ideally — carrier
   NAT is the condition most likely to need a relay). At least one device on
   Chrome/Edge for `chrome://webrtc-internals`. Two MenRush accounts that can
   call each other.
2. Real call, Device A → Device B. Note whether remote video renders.
3. In `chrome://webrtc-internals`, find the active `RTCPeerConnection`.
   Check the selected ICE candidate pair's local/remote types, and whether
   any `relay` candidate was gathered at all.
4. Check `bytesReceived`/`bytesSent` on the video `RTCInboundRtpStream` —
   a call can show `connected` with these stuck at 0.
5. Swap roles (B calls A) to rule out a one-directional issue.

Diagnosis is confirmed if this reproduces "0 relay candidates" on a real
cross-network call, matching `005b2c8`'s sandbox finding.

### Step 2 — Get trial TURN credentials

Third-party account creation isn't something I can do — this step is yours.
Sign up for Cloudflare Realtime (or Twilio NTS as fallback), enable TURN,
generate a credential, and confirm whether it's TURN-REST HMAC (matches
`createTurnRestCredentials` as-is) or something else (would need a small
`webrtc.service.ts` change).

### Step 3 — Point a non-production environment at it

Checked `docs/railway-deploy.md`: there is **no separate Railway staging
service** documented for this project — Railway currently hosts one backend
service. So "non-prod" here means a **local `.env`** pointed at the same
Supabase/Postgres backend, not a second Railway environment. If you want a
real Railway staging service, that's a new piece of infra to provision, not
something already sitting there to point at.

1. Set `TURN_URL` + `TURN_SECRET` (or `TURN_USERNAME`/`TURN_CREDENTIAL`) in
   local `backend/.env` only.
2. Re-run Step 1's test against the local backend.
3. Confirm: does a `relay` candidate get selected, and does media flow
   (`bytesReceived > 0`)?

### Step 4 — Promote to production

Only after Step 1 shows 0 relay candidates on the current config **and**
Step 3 shows a relay candidate + real media flow on the trial provider. Then:

1. Set `TURN_URL`/`TURN_SECRET` in Railway's backend environment variables.
2. Redeploy, re-run the two-device call once more against production.
3. Close #73: document root cause, extend
   `frontend/e2e/video-call.spec.ts` to assert remote-stream attachment.
4. Confirm the fix holds for both 1:1 and group mesh calls (per `846eeeb`/
   `fe68e25` history) and doesn't regress #34's post-call camera cleanup.

## 4. Guardrails

- Production `TURN_URL`/`TURN_SECRET` stay untouched until Steps 1 and 3
  both pass.
- No paid commitment until a trial tier proves the fix — both providers
  above have a free/trial tier sufficient for validation.
- Re-confirm pricing at signup regardless of the table above — it's dated
  today, providers change tiers.
- Once GitHub is authorized, pull the actual #73 comment thread and
  reconcile it against §2 of this doc before calling the provider decision
  final.
