# MenRush Verification — Phase 2 Architecture

**Date:** 25 July 2026  
**Status:** Implementation-ready design; provider sandbox and legal approval still required  
**Recommended provider pilot:** Persona  
**Provider fallback:** Veriff

Related documents:

- [Phase 1 executive summary](./phase-1-executive-summary.md)
- [Phase 1 technical blueprint](./phase-1-world-class-verification-blueprint.md)
- [Phase 2 provider decision](./phase-2-provider-decision.md)

## 1. Outcome

Replace the home-grown biometric decision engine with provider-direct capture and provider decisions while retaining MenRush's existing Trust Centre, policy, account binding, badges, appeals, audit trail and privacy controls.

The architecture supports three distinct claims:

1. **Adult confirmed** — mandatory age assurance.
2. **Authentic person** — optional live-human proof without government ID.
3. **Identity checked** — optional government ID plus live-person match.

No tier is Premium. No optional tier blocks ordinary access. A stronger tier includes the weaker trust meaning for display purposes only when the underlying checks actually passed.

## 2. Critical current-state findings

The repository already contains useful building blocks:

- `VerificationCentre.tsx` for the trust-tier UI;
- `Verify.tsx`, `VerifyScan.tsx` and `VerificationQr.tsx` for ID and phone handoff;
- `AuthenticityVerify.tsx` for no-ID authenticity;
- `backend/src/routes/verify.ts` and verification services;
- Socket.IO event `verify:handoff` plus polling;
- database records for verification submissions, authenticity challenges and handoff sessions;
- sensitive-file deletion timestamps and purge tooling.

These should be adapted, not thrown away.

The current implementation also has four production blockers:

1. MenRush itself receives and stores ID/selfie files.
2. Local heuristics and optional model integrations are being treated as verification controls.
3. Authentication routing still redirects users with legacy `pending` or `rejected` identity states to ID verification, which conflicts with optional ID.
4. `CLAUDE.md` still says the final stack must be in-house, while Phase 1 concluded that a hybrid specialist-provider architecture is safer. That is an explicit architecture-policy change and should be recorded in the repository when implementation is approved.

## 3. Trust and authority model

### MenRush owns

- the reason a check is requested;
- the wording and consent shown before capture;
- whether a tier is mandatory or optional;
- the association between an authenticated account and a provider session;
- the final internal status and badge;
- rate limits, retry limits and fraud response;
- user-facing explanations, support, appeal and re-check policy;
- deletion policy and evidence;
- audit logs and monitoring;
- provider failover.

### Provider owns

- camera and document capture inside its controlled flow;
- document authenticity models;
- presentation-attack detection and liveness;
- face comparison where needed;
- fast-changing injection/deepfake defences;
- capture-quality feedback;
- the provider decision and reason codes.

### The browser never owns

- approval;
- a badge;
- account binding;
- webhook authenticity;
- final result mapping;
- deletion confirmation.

An SDK `onComplete` callback means only that the capture flow closed or submitted. MenRush waits for a verified server-to-server result.

## 4. Target user journeys

### 4.1 Adult confirmed

1. Registration creates an account with `age_assurance_status = pending`.
2. MenRush explains that the app is adults-only and offers the approved age methods.
3. The backend creates a short-lived provider session for the UK 18+ claim.
4. The browser opens the provider flow.
5. The provider returns only pass/fail and method class where possible.
6. A signed webhook reaches MenRush.
7. MenRush verifies the signature, session binding, event identity and current state.
8. A pass changes `age_assurance_status` to `confirmed`.
9. Raw evidence is deleted by provider policy; MenRush records deletion state, not the evidence.
10. A fail or uncertain result offers another approved method and support, without exposing a guessed exact age.

Self-attested age is not Adult confirmed.

### 4.2 Authentic person

1. The user chooses the optional badge in Trust Centre.
2. MenRush explains: “This proves a live person completed the check. It does not prove a legal identity.”
3. The backend creates a liveness/humanness session bound to that user.
4. Provider-controlled capture asks for a live face capture.
5. MenRush accepts only the provider's signed result.
6. A pass changes `authenticity_status` to `verified` and awards the Authentic person badge.
7. A failure gives corrective help or appeal; it does not remove app access.

The public profile never displays a selfie, legal name or age estimate.

### 4.3 Identity checked

1. The user chooses the optional strongest badge.
2. MenRush states what will be checked, what will not be displayed and when evidence is deleted.
3. The backend creates an ID-plus-selfie provider session.
4. On desktop, the provider or MenRush wrapper offers secure phone handoff.
5. Provider capture handles document edges, glare, focus, portrait and live selfie.
6. MenRush receives a signed result containing the minimum status and stable reason category.
7. A pass changes `verification_status` to `approved` and `is_verified` to true for legacy compatibility.
8. MenRush publishes only Identity checked.
9. Provider deletion is requested/confirmed according to the short retention policy.

### 4.4 Desktop-to-phone handoff

1. Desktop asks the backend for the current verification session.
2. Backend creates or obtains a single-use, short-lived link.
3. Desktop renders the link as a QR code with no PII.
4. Phone opens the same provider inquiry/session.
5. Link use is limited and expires quickly.
6. Desktop listens for a MenRush Socket.IO status event and polls as fallback.
7. Provider completion is authoritative only after the signed webhook.
8. Desktop shows “Received — checking now,” then the final outcome.

Do not mark completion because the phone navigated to a success page.

## 4.5 Exact MenRush flow and copy

The custom MenRush layer surrounds provider capture. Keep the language short, direct and honest.

### Adult confirmed

1. **Title:** “Confirm you’re 18+”
2. **Body:** “MenRush is for adults. Complete a private age check to continue.”
3. **Privacy line:** “We need an over-18 result — not your public legal name.”
4. **Primary action:** “Confirm my age”
5. **Secondary action:** “See other ways”
6. Provider capture opens.
7. On provider submission: “Received — checking now.”
8. On pass: “Adult confirmed. You can continue to MenRush.”
9. On uncertainty: “We couldn’t confirm your age this way. Try another private method.”
10. On technical failure: “The check didn’t finish. Nothing has been approved or rejected. Try again.”

### Authentic person

1. **Title:** “Show you’re a real person”
2. **Body:** “Complete a short live camera check. No government ID is needed.”
3. **Meaning line:** “This badge confirms a live person — not a legal identity.”
4. **Primary action:** “Start live check”
5. **Secondary action:** “Not now”
6. Provider liveness/humanness capture opens.
7. On submission: “Received — checking the live capture.”
8. On pass: “Authentic person badge earned.”
9. On retry: “We need one clearer attempt. Follow the camera guidance and try again.”
10. On fail: “We couldn’t complete this check. Your MenRush access has not changed.”

### Identity checked

1. **Title:** “Add the strongest trust badge”
2. **Body:** “Privately match a government ID to a live camera check.”
3. **Privacy line:** “Your legal name and ID are never shown on your profile.”
4. **Retention line:** “MenRush does not keep the ID or selfie. The verification provider deletes the evidence under our short-retention policy.”
5. **Primary action:** “Check my identity”
6. **Secondary action:** “Not now”
7. On desktop: “Use your phone for the clearest scan” with QR, plus “Use this device.”
8. On phone claim: desktop shows “Phone connected.”
9. On provider submission: “ID received — checking now.”
10. On pass: “Identity checked badge earned.”
11. On retry: “One image needs another attempt. Your badge has not been decided yet.”
12. On provider review: “Your check was received. We’ll update this screen when the result is ready.”
13. On fail: “We couldn’t complete the identity check. You can retry or ask for help. Your app access has not changed.”

### Consent checkpoint

The primary action stays disabled until the user has seen:

- what will be checked;
- the provider's name;
- whether biometric processing is involved;
- the purpose and legal basis;
- the evidence retention/deletion window;
- how to withdraw before submission;
- the alternative and appeal route.

Do not use a bundled “by continuing you agree to everything” sentence for biometric consent.

## 5. Frontend architecture

### Keep

- `/verify` as Trust Centre.
- The current MenRush visual language and preflight explanations.
- Status pages that survive refresh.
- Socket.IO with polling fallback.
- A visible optional/mandatory distinction.

### Replace

- Direct local ID and selfie uploads for production provider flows.
- Local capture-quality results presented as official verification.
- The current QR link to the unauthenticated MenRush upload page when provider handoff is active.
- “In review” wording without confirmation that evidence was successfully received.

### Add

`frontend/src/features/verification/`:

```text
provider/
  ProviderFlow.tsx
  ProviderRedirect.tsx
status/
  VerificationStatusCard.tsx
  VerificationTimeline.tsx
consent/
  VerificationConsent.tsx
support/
  VerificationHelp.tsx
```

`ProviderFlow` receives only:

```ts
type ProviderFlowProps = {
  sessionId: string;
  launchUrl?: string;
  clientToken?: string;
  onCaptureClosed: () => void;
};
```

It must never receive the provider API secret or decide a result.

### Concrete React orchestration pattern

The provider-neutral UI can be implemented without letting the component interpret a provider result:

```tsx
type Purpose = 'adult_confirmed' | 'authentic_person' | 'identity_checked';

type SessionView = {
  sessionId: string;
  status: 'created' | 'in_progress' | 'submitted' | 'passed'
    | 'retry_required' | 'review_required' | 'failed' | 'expired';
  launch?: { mode: 'hosted' | 'embedded'; url: string };
};

export function StartVerification({ purpose }: { purpose: Purpose }) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const { data } = await apiClient.post<SessionView>(
        '/verification/sessions',
        { purpose, channel: 'web', returnPath: '/verify' },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      );
      setSession(data);
      if (data.launch?.mode === 'hosted') {
        window.location.assign(data.launch.url);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={start} disabled={busy}>
      {busy ? 'Preparing secure check…' : 'Start secure check'}
    </button>
  );
}
```

On return from the provider, the page ignores query-string claims such as `success=true`. It reads the internal session:

```tsx
useEffect(() => {
  if (!sessionId) return;

  let active = true;
  const refresh = async () => {
    const { data } = await apiClient.get<SessionView>(
      `/verification/sessions/${sessionId}`,
    );
    if (active) setSession(data);
  };

  void refresh();
  const timer = window.setInterval(refresh, 4_000);
  return () => {
    active = false;
    window.clearInterval(timer);
  };
}, [sessionId]);
```

Socket.IO triggers an immediate `refresh`; it does not directly set `passed`.

### Automatic capture ownership

For the production provider flow:

- use the provider's capture SDK/hosted flow for full-resolution acquisition;
- let its document-edge, glare, focus, perspective, face-position and liveness controls decide when capture is acceptable;
- keep MenRush guidance outside the provider viewport unless the provider explicitly supports safe customisation;
- record capture-method metadata only when the provider returns a non-sensitive method class;
- test assisted auto-capture separately from gallery upload and manual shutter;
- disable insecure upload fallbacks for high-assurance checks unless an accessibility/compatibility policy explicitly allows them;
- never run a second lossy canvas export before sending media to the provider.

The existing MenRush camera quality code can remain a prototype and test harness, but it must not override the provider's production decision. Phase 1 contains the detailed multi-frame quality-controller design if MenRush later needs a provider-approved custom capture layer.

### User-facing statuses

| Internal state | User text |
|---|---|
| `created` | Ready to begin |
| `in_progress` | Check in progress |
| `submitted` | Received — checking now |
| `passed` | Check complete |
| `retry_required` | We need one clearer attempt |
| `review_required` | Received — an additional check is needed |
| `failed` | We could not complete this check |
| `expired` | This secure link expired |
| `cancelled` | Check cancelled |
| `provider_unavailable` | The verification service is temporarily unavailable |

Never show “submitted for review” until the backend has evidence of provider submission. Never show “verified” before the backend records a verified webhook decision.

## 6. Backend API

Use a new stable product API rather than exposing provider vocabulary:

### `POST /api/verification/sessions`

Authenticated. Creates or resumes one active attempt.

Request:

```json
{
  "purpose": "adult_confirmed | authentic_person | identity_checked",
  "channel": "web",
  "returnPath": "/verify"
}
```

Response:

```json
{
  "sessionId": "internal-uuid",
  "status": "created",
  "expiresAt": "ISO-8601",
  "launch": {
    "mode": "hosted | embedded",
    "url": "short-lived-provider-url"
  }
}
```

Rules:

- derive `userId` from authentication, never request body;
- accept an idempotency key;
- allow one active session per user and purpose;
- generate an opaque provider reference, never the email or username;
- rate-limit creation;
- never return provider secrets.

### `GET /api/verification/sessions/:id`

Authenticated and owner-bound. Returns the minimal internal state, public reason and available next action.

### `POST /api/verification/sessions/:id/retry`

Authenticated and owner-bound. Enforces retry limits and creates/resumes the correct provider flow.

### `POST /api/verification/sessions/:id/cancel`

Authenticated and owner-bound. Cancels an unfinished optional attempt and schedules evidence deletion.

### `POST /api/verification/providers/persona/webhook`

Public network endpoint with strict controls:

- retain the exact raw request body needed for signature verification;
- verify `Persona-Signature` with the webhook secret;
- reject an invalid timestamp/signature;
- store a hash/event ID for idempotency;
- acknowledge duplicates without applying the transition twice;
- map only known event types and provider statuses;
- find the internal session through the stored provider inquiry ID/reference;
- never trust client callbacks;
- enqueue processing and respond quickly;
- redact payloads in logs.

### `POST /api/verification/providers/veriff/webhook`

Fallback adapter endpoint:

- verify `X-AUTH-CLIENT` and `X-HMAC-SIGNATURE`;
- store and deduplicate provider attempt/event identifiers;
- map approved, declined, resubmission requested, review, expired and abandoned;
- poll the provider decision endpoint only as a reconciliation fallback.

## 7. Provider abstraction

Add a provider-neutral interface:

```ts
export type VerificationPurpose =
  | 'adult_confirmed'
  | 'authentic_person'
  | 'identity_checked';

export type VerificationOutcome =
  | 'passed'
  | 'retry_required'
  | 'review_required'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface VerificationProvider {
  createSession(input: {
    internalSessionId: string;
    subjectReference: string;
    purpose: VerificationPurpose;
    callbackUrl: string;
  }): Promise<{
    providerSessionId: string;
    launchUrl?: string;
    clientToken?: string;
    expiresAt: Date;
  }>;

  verifyWebhook(input: {
    rawBody: Buffer;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<{
    providerEventId: string;
    providerSessionId: string;
    occurredAt: Date;
    outcome: VerificationOutcome | null;
    reasonCode?: string;
    deletionConfirmed?: boolean;
  }>;

  getDecision(providerSessionId: string): Promise<{
    outcome: VerificationOutcome;
    reasonCode?: string;
  }>;

  requestDeletion(providerSessionId: string): Promise<void>;
}
```

Provider reason codes are mapped into stable MenRush categories:

- `capture_quality`;
- `document_unsupported`;
- `document_expired`;
- `document_suspected_fraud`;
- `liveness_failed`;
- `face_mismatch`;
- `age_requirement_not_met`;
- `provider_review`;
- `session_expired`;
- `technical_failure`;
- `unknown`.

Detailed fraud signals stay private to authorised staff and must not be exposed in a way that teaches attackers.

### Concrete Express webhook pattern

Mount the provider webhook with raw-body parsing before the general JSON parser:

```ts
app.post(
  '/api/verification/providers/persona/webhook',
  express.raw({ type: 'application/json', limit: '512kb' }),
  personaWebhookController,
);

app.use(express.json({ limit: '1mb' }));
```

The controller performs no badge mutation until verification succeeds:

```ts
export async function personaWebhookController(req: Request, res: Response) {
  const event = await personaProvider.verifyWebhook({
    rawBody: Buffer.from(req.body),
    headers: req.headers,
  });

  await verificationEvents.applyIdempotently(event);
  res.sendStatus(204);
}
```

`applyIdempotently` opens one database transaction, inserts the unique provider event, locks the attempt row, validates the transition, updates the relevant user trust field and commits. The Socket.IO notification is emitted only after commit.

## 8. State machine

```text
created
  -> in_progress
  -> submitted
      -> passed
      -> retry_required -> in_progress
      -> review_required -> passed | failed
      -> failed
  -> expired
  -> cancelled
```

Side state:

```text
evidence: not_collected | retained_by_provider | deletion_requested | deleted | deletion_failed
```

Rules:

- terminal outcomes do not move backwards except through a new attempt;
- `passed` requires a verified provider event or an explicitly audited manual appeal;
- duplicate events are no-ops;
- older events cannot override newer terminal decisions;
- deletion is independent of the verification result;
- provider outages do not convert uncertainty to failure or pass.

## 9. Data model

Use a new migration after reconciling the repository's migration numbering.

### `verification_attempts`

| Field | Purpose |
|---|---|
| `id` | MenRush UUID |
| `user_id` | Authenticated subject |
| `purpose` | One of the three trust purposes |
| `provider` | `persona`, `veriff`, or controlled legacy value |
| `provider_session_id` | Encrypted or access-controlled provider reference |
| `status` | Internal state |
| `public_reason_code` | Stable non-sensitive reason |
| `provider_reason_code` | Restricted diagnostic value |
| `attempt_number` | Retry accounting |
| `expires_at` | Session TTL |
| `submitted_at`, `decided_at` | Timing |
| `deletion_status` | Evidence deletion state |
| `deletion_requested_at`, `deleted_at` | Deletion evidence |
| `created_at`, `updated_at` | Audit |

### `verification_provider_events`

| Field | Purpose |
|---|---|
| `id` | Internal UUID |
| `provider` | Source |
| `provider_event_id` | Unique idempotency key |
| `attempt_id` | Internal association |
| `event_type` | Normalised event |
| `payload_hash` | For audit without storing raw PII |
| `signature_valid` | Must be true before processing |
| `occurred_at`, `received_at`, `processed_at` | Ordering and latency |
| `processing_error` | Redacted operational error |

Do not store raw webhook bodies long-term if they contain identity data. Verify in memory, extract the minimum result, hash for audit, then discard.

### Existing user fields

- `age_assurance_status` remains the baseline trust result.
- `authenticity_status` remains the live-human result.
- `verification_status` remains the identity-check result.
- `is_verified` remains a temporary compatibility mirror of successful identity checking.

Add database constraints so a rejected or pending optional ID attempt cannot remove ordinary access.

## 10. Real-time updates and reconciliation

On every accepted state transition:

1. commit the database transaction;
2. emit `verification:status` to `user:{userId}`;
3. frontend refetches the session and Trust Centre status;
4. polling continues at a modest interval while non-terminal;
5. a background reconciliation job queries provider state for sessions stuck beyond the expected webhook window.

The Socket.IO message contains only:

```json
{
  "sessionId": "internal-uuid",
  "purpose": "identity_checked",
  "status": "submitted",
  "updatedAt": "ISO-8601"
}
```

## 11. Privacy and retention

### MenRush storage

Store:

- the claim attempted;
- provider and opaque provider reference;
- status, timestamps and coarse reason;
- consent version;
- deletion status;
- appeal/audit metadata.

Do not store:

- raw ID images;
- raw selfies or video;
- biometric templates or embeddings;
- document number;
- address;
- legal name;
- full date of birth;
- nationality unless separately and lawfully needed;
- exact age estimate when an over-18 result is enough;
- provider webhook payloads containing those fields.

### Retention target

- Provider evidence: delete immediately after decision where supported; absolute product target no longer than 72 hours except a specifically documented legal hold.
- MenRush result: retain while the badge/account requires it, with periodic re-check policy.
- Provider events: retain only minimal non-PII audit data according to security/audit need.
- Failed/cancelled attempt metadata: short operational retention, then aggregate or delete.
- Deletion failures: alert and retry; never silently mark deleted.

### Legal and governance gates

Before production:

- complete a UK GDPR DPIA;
- document Article 6 basis and Article 9 condition for biometric processing;
- obtain valid explicit consent where relied upon;
- offer a practical alternative and appeal;
- update privacy notice and in-product just-in-time notice;
- execute DPA and international-transfer assessment;
- review provider subprocessors and data locations;
- document Ofcom age-assurance evidence and method suitability;
- define support access and staff permissions;
- test data-subject access/deletion handling.

## 12. Security controls

- Secrets remain backend-only in a managed secret store.
- Separate sandbox and production keys.
- Verify webhook signatures over the exact raw body.
- Require TLS and restrict methods/content types/body sizes.
- Apply replay/timestamp checks where the provider supports them.
- Store provider event IDs uniquely.
- Bind every session to one authenticated user and one purpose.
- Use opaque random references; never place account PII in QR codes.
- Expire handoff links quickly and limit reuse.
- Rate-limit creation, retries and webhook error paths.
- Redact headers, tokens, URLs and payloads from logs and Sentry.
- Restrict admin views; staff see decision evidence only when necessary.
- Record every manual decision and evidence access.
- Use constant-time comparison for signatures.
- Reconcile webhooks against provider API before resolving material conflicts.
- Add kill switches per provider and per trust purpose.

Suggested configuration:

```text
VERIFICATION_PROVIDER=persona
VERIFICATION_ADULT_ASSURANCE_ENABLED=false
VERIFICATION_AUTHENTICITY_ENABLED=false
VERIFICATION_IDENTITY_ENABLED=false
VERIFICATION_PROVIDER_WEBHOOKS_ENABLED=false
VERIFICATION_PROVIDER_DELETION_ENABLED=false
```

Every flag starts false outside the sandbox. Do not reuse the legacy `REQUIRE_ID_VERIFICATION` flag for optional ID.

## 12.1 Presentation-attack strategy

MenRush should not rebuild a biometric presentation-attack detector as its primary production control. The provider is selected and contractually tested for PAD and injection defence. MenRush adds independent session and account-abuse controls around it.

### Provider evidence required

- ISO/IEC 30107-3 PAD evaluation scope, laboratory, version and attack species;
- results for printed photos, screen replay, masks and video injection;
- deepfake/virtual-camera testing;
- model/version change notification;
- demographic and device error analysis;
- false-accept and false-reject evidence at the contracted operating point;
- handling of low confidence and unavailable signals.

### Signal interpretation

| Signal | Use | Do not do |
|---|---|---|
| Active prompts | Add unpredictability and temporal evidence | Treat blink/smile/turn alone as proof |
| Passive texture/material analysis | Detect print, display and mask artefacts | Assume it generalises to every camera/material |
| Depth/reflectance | Add 3D/material evidence where hardware permits | Reject users merely because depth is unavailable |
| Temporal consistency | Detect frame synthesis and replay anomalies | Reduce the decision to one threshold |
| rPPG | Optional weak physiological evidence in a fused model | Claim pulse alone proves liveness |
| PRNU/sensor traces | Supporting source/injection evidence | Require a stable browser camera fingerprint |
| Device/injection telemetry | Detect virtual camera, emulator and tampering risk | Equate unsupported telemetry with fraud |

rPPG, texture and sensor-noise signals belong inside a calibrated, independently evaluated multi-signal provider model. Modern synthesis can imitate periodic colour changes; compression and camera processing damage PRNU; skin tone, light, motion and device pipelines affect both. “Signal missing” is uncertainty, not guilt.

### MenRush response bands

- **Low risk + provider pass:** award the exact requested claim.
- **Uncertain/capture issue:** corrective retry or alternate method.
- **Provider review:** durable pending state; no badge yet.
- **High-confidence attack:** fail attempt, add cooldown and protect the account.
- **Repeated linked abuse:** escalate account/device/network controls without publishing the reason.

## 12.2 Fraud and risk scoring

Keep biometric decisions and account-abuse risk related but separable. A genuine live person can still run scams; a failed camera session is not proof of malicious intent.

### Inputs

- provider outcome and coarse risk category;
- attempt velocity by account, device, IP prefix and provider reference;
- repeated document or face reuse signals returned lawfully by the provider;
- disposable email and account-age signals;
- impossible travel and rapid location changes;
- emulator, proxy, Tor, datacentre or automation indicators;
- graph links to previously actioned accounts;
- repeated QR claim from multiple devices;
- behavioural automation patterns;
- payment abuse only where relevant and lawfully linked.

### Example internal model

```text
risk = clamp(
  0.30 * providerFraud +
  0.20 * velocity +
  0.15 * deviceIntegrity +
  0.15 * linkedAccountRisk +
  0.10 * networkRisk +
  0.10 * behaviouralAutomation,
  0, 100
)
```

This is an initial policy shape, not a trained or validated algorithm. Calibrate weights using labelled incidents and false-positive review. Never silently add protected characteristics or inferred sexual orientation. Do not use exact geography beyond what is necessary for security.

### Actions

| Score band | Action |
|---|---|
| 0–29 | Normal flow |
| 30–59 | Extra telemetry, tighter attempt limit or alternate method |
| 60–79 | Manual/security review; do not award optional badge |
| 80–100 | Block attempt, cooldown and investigate linked abuse |

Thresholds must be feature-flagged and shadow-tested before enforcement.

## 12.3 Passkeys after assurance

Passkeys protect the account after proofing; they are not an identity badge and do not replace age assurance.

Recommended sequence:

1. After Adult confirmed, offer “Protect this account with a passkey.”
2. Create the WebAuthn registration challenge on the backend.
3. Bind it to the authenticated user, relying party ID, origin and a short expiry.
4. Verify origin, RP ID hash, challenge, flags and signature server-side.
5. Store credential ID, public key, counter/backup metadata and timestamps—not a device biometric.
6. On login, verify an authentication assertion, then issue the normal short-lived MenRush JWT.
7. Require a passkey or another strong factor before changing email, exporting sensitive data, disabling 2FA or appealing a high-risk verification decision.
8. Provide multiple passkeys, recovery codes and a reviewed recovery process.

Do not let an email link alone bypass a passkey on an Identity checked account. Do not imply Face ID or fingerprint data is sent to MenRush; the device authenticator keeps that biometric local.

## 13. Failure, retry and appeal policy

### Retry

- Give a specific corrective instruction for capture-quality failures.
- Resume the same provider inquiry when safe.
- Limit repeated attempts and add cooldowns.
- Do not describe anti-fraud internals.
- Technical provider failures do not consume a fraud retry.

### Appeal

- Optional badge failures do not restrict app access.
- Adult-assurance failures offer another approved method and human support.
- Manual approval must require authorised staff, a reason and an audit record.
- Human reviewers see the minimum evidence required.
- Appeals do not extend raw evidence retention without a documented, disclosed need.

### Provider outage

- Stop creation of new affected sessions.
- Preserve existing terminal trust results.
- Show a neutral temporary message.
- Queue reconciliation for submitted sessions.
- Do not fall back automatically to the home-grown biometric engine in production.
- Use the alternate provider only after its integration and legal configuration are production-approved.

## 14. Implementation map

### Phase 2A — policy correction

1. Remove legacy login and route redirects that make optional ID a gate.
2. Keep mandatory gating tied only to confirmed adult assurance when that approved method is ready.
3. Update `CLAUDE.md` from “in-house only” to the approved hybrid architecture.
4. Freeze new features in local ID/selfie decision code.

### Phase 2B — provider-neutral backend

1. Add the attempt/event data model.
2. Add the provider interface and Persona adapter.
3. Add session/status/retry/cancel routes.
4. Add raw-body signed webhook handling.
5. Add idempotent state transitions.
6. Add deletion requests and evidence.
7. Add reconciliation worker and metrics.

### Phase 2C — frontend flow

1. Keep the Trust Centre.
2. Add consent/preflight by purpose.
3. Launch embedded or hosted Persona flow.
4. Use provider device handoff.
5. Add durable received/checking/result screens.
6. Add retry, alternative and support routes.

### Phase 2D — sandbox proof

1. Test all three trust purposes.
2. Test webhook signatures, duplicates, delays and reordering.
3. Test QR handoff and expiry.
4. Test deletion and confirm the provider no longer exposes evidence.
5. Run device, accessibility and adversarial matrices.
6. Compare Persona with Veriff on the same written rubric.

### Phase 2E — controlled rollout

1. Staff and named test accounts.
2. Small UK cohort with kill switches.
3. Observe completion, retries, error rates, deletion and support demand.
4. Expand only if thresholds pass.
5. Keep optional ID and authenticity clearly optional throughout.

## 14.1 High-conversion product rules

- Ask only for the tier needed at that moment.
- Explain benefit before camera permission.
- Put “No government ID needed” prominently on Authentic person.
- Put “Optional” beside every optional badge entry and action.
- Make privacy and deletion visible without forcing a legal-text wall.
- Prefer provider-assisted automatic capture with one instruction at a time.
- Detect desktop early and offer phone QR before a poor laptop capture.
- Preserve progress across handoff, refresh and temporary network loss.
- Distinguish “received,” “checking,” “needs another attempt” and “failed.”
- Never blame the user for camera or provider failure.
- Let users postpone optional verification with one tap.
- Use support copy that says what happens next and when.
- Measure abandonment at each step before changing thresholds.

## 14.2 Cost control and switching

Keep every provider call behind `VerificationProvider`. Store internal purposes and outcomes, not provider enums, throughout product code. Provider IDs appear only in the adapter and restricted records.

Cost controls:

- resume an eligible active session instead of creating duplicates;
- use idempotency keys;
- separate technical failures from billable retries in reporting;
- apply age-only or humanness-only products when they satisfy the exact claim;
- use IDV only for the optional Identity checked tier;
- monitor manual-review and resubmission charges;
- set volume alerts and daily creation caps;
- negotiate sandbox, retry, deletion, support and minimum-commit terms;
- obtain every budget and invoice in GBP.

Switching runbook:

1. approve the alternate provider's legal/security configuration;
2. implement its adapter against the same contract tests;
3. run shadow/sandbox comparison;
4. enable only new sessions for a small cohort;
5. never migrate raw biometric evidence between providers;
6. preserve historical MenRush results and deletion records;
7. reconcile all in-flight sessions before disabling the old webhook;
8. retain a read-only reconciliation path until the contract deletion report is complete.

## 15. Tests required before production

### Unit

- provider status mappings;
- state-transition guards;
- signature verification;
- reason-code redaction;
- idempotency;
- retry accounting;
- deletion state transitions.

### Integration

- create session with account/purpose binding;
- valid and invalid webhook signatures;
- duplicate and out-of-order events;
- callback without webhook cannot pass;
- polling reconciliation;
- provider timeout;
- deletion retry;
- optional ID failure leaves access unchanged.

### End-to-end

- adult assurance pass/fail/alternative;
- authenticity pass/retry/fail;
- ID pass/retry/review/fail;
- desktop-to-phone handoff;
- refresh during processing;
- expired one-time link;
- user cancellation;
- provider outage;
- keyboard/screen-reader flow.

### Privacy regression

Automated tests must assert that fixture names, document numbers, base64 images, media URLs, tokens and raw webhook payloads do not appear in:

- application logs;
- analytics;
- error tracking;
- database result tables;
- Socket.IO events;
- browser local/session storage beyond the provider's required short-lived token.

## 16. Operational metrics

Measure by purpose, provider, platform and device class:

- session creation success;
- start, submission and completion conversion;
- time to submit and time to decision;
- retry and resubmission rates;
- provider review rate;
- coarse failure category;
- QR handoff start/completion;
- abandonment step;
- webhook latency and signature failure;
- reconciliation count;
- deletion latency/failure;
- support and appeal rate.

Review fairness using privacy-preserving, appropriately consented cohort analysis. Do not collect sensitive demographic attributes casually just to build a dashboard.

### Alerts

- provider session creation failure above baseline;
- webhook signature failure;
- webhook latency or backlog;
- sessions stuck in submitted/review beyond SLA;
- reconciliation divergence;
- sudden retry, rejection or abandonment spike;
- QR handoff claim anomaly;
- deletion request failure or age above retention target;
- unexpected raw-media/PII pattern in logs;
- daily cost or session-volume anomaly;
- outcome disparity requiring investigation.

Every alert needs an owner, severity, runbook and safe kill-switch action.

## 16.1 Phase 2 success metrics

Set numerical launch targets before testing so results cannot be rationalised afterwards.

At minimum define:

- eligible users who start each flow;
- start-to-submit conversion;
- first-attempt capture success;
- overall completion;
- median and 95th-percentile time to submit and decision;
- mobile and desktop-to-phone handoff completion;
- technical failure, retry, manual-review and abandonment;
- false-rejection estimate from resolved appeals;
- confirmed attack escape rate from red-team testing;
- accessibility task completion;
- webhook availability and processing latency;
- deletion completion within policy;
- support contacts per 1,000 attempts;
- cost per completed claim in GBP.

Report by provider, purpose, platform and device class. A high pass rate is not success if attacks pass, legitimate cohorts are rejected, or evidence is retained too long.

## 16.2 Founder executive summary

MenRush should stop trying to make its own camera heuristics carry the burden of production identity verification. Keep the MenRush Trust Centre, privacy promise, badges and user experience, but let a specialist provider perform capture, document checks, liveness and face comparison.

Pilot Persona first because its public architecture most closely matches MenRush's three separate needs: a private UK 18+ result, an optional live-person check without ID, and optional ID plus selfie. Its claim-only Relay design can avoid giving MenRush a user's legal identity when all MenRush needs is “over 18” or “real human.” Veriff remains a serious fallback and may outperform it on capture or commercial terms.

The provider never decides product access by itself. MenRush creates a short-lived account-bound session, accepts only signed server webhooks, stores a minimal result, updates desktop from the backend after phone handoff, and monitors deletion. Raw IDs, selfies, videos and biometric templates do not belong in MenRush storage.

Before production, the team must remove legacy routing that makes optional ID act mandatory, complete the DPIA and contracts, prove deletion, test real devices and attacks, test accessibility and appeals, and agree numerical success thresholds. Until those gates pass, this is a sandbox pilot—not a production verification claim.

## 17. Definition of done

Phase 2 implementation is complete only when:

- one provider sandbox completes all three intended claims or an explicitly approved multi-provider split;
- no raw ID/selfie evidence reaches MenRush application storage;
- signed webhooks are the normal authority;
- QR phone completion updates desktop through the backend;
- optional checks never gate ordinary access;
- result wording precisely matches the check performed;
- provider deletion is tested and monitored;
- DPIA, DPA, transfer, retention and subprocessor reviews are approved;
- accessibility and alternative paths work;
- pilot thresholds pass;
- rollback and provider outage drills succeed.

Until then, the existing local verifier is a prototype and must not be described as production-grade identity verification.

## 18. Deliverable index

| Required deliverable | Where covered |
|---|---|
| 1. Complete architecture | Sections 1–3, 5–11 |
| 2. Exact MenRush user flow | Sections 4 and 4.5 |
| 3. React + TypeScript plan and code | Section 5 |
| 4. Backend/API/schema/state/webhooks | Sections 6–10 |
| 5. Provider recommendation | Phase 2 provider decision |
| 6. GDPR biometric and retention policy | Section 11 |
| 7. PAD, rPPG, texture and sensor noise | Section 12.1 |
| 8. Fraud/risk scoring | Section 12.2 |
| 9. WebAuthn/passkeys | Section 12.3 |
| 10. Security checklist | Section 12 |
| 11. File/folder structure | Sections 5, 7 and 14 |
| 12. Phased roadmap | Section 14 |
| 13. High-conversion UX | Section 14.1 |
| 14. Cost and provider switching | Provider decision and section 14.2 |
| 15. Monitoring and alerting | Section 16 |
| 16. Rollout and risk mitigation | Sections 13 and 14 |
| 17. Success metrics | Section 16.1 |
| 18. Executive summary | Section 16.2 |
