# World-Class Identity Verification — Founder Executive Summary

**Phase 1 research summary — 25 July 2026**

Identity verification is not one check. A reliable system separately establishes whether evidence is usable, an ID is authentic, a live person is present, that face matches the trusted portrait, and the session is not part of fraud or account farming.

The right default architecture is hybrid. The product owns purpose, consent, branded UX, account binding, decisions, appeals and retention. A specialist provider owns raw capture, document models, liveness, face comparison and fast-changing defenses. Keeping media inside the provider reduces breach exposure only when access and deletion are tested.

The browser never decides that a user passed. An SDK callback means only “capture finished.” The backend creates and binds a short-lived provider session, verifies signed webhooks, handles duplicate/out-of-order events, and stores a minimal result. QR handoff uses a one-time expiring token; desktop learns completion from the backend.

Automatic capture is a first-class subsystem, not a countdown. Excellent implementations detect the document or face, score geometry, sharpness, glare, motion and lighting inside the relevant region, require several consecutive acceptable frames, and select the best full-resolution frame. They provide one corrective instruction at a time and fall back accessibly after repeated failure. Thresholds must be calibrated on representative devices and cohorts; a fixed Laplacian number or “face inside circle” check is not production quality.

No single liveness signal is safe enough:

- Blink, smile or head-turn alone stops only basic attacks.
- Texture, moiré, depth and reflection can fail on unseen devices/materials.
- rPPG estimates pulse from skin-color changes, but research shows digital perturbation and controlled light can fake heartbeat signals—even on masks.
- PRNU camera fingerprints add forensic evidence, but compression and stabilization make them unreliable as a primary web control.

The answer is multi-signal fusion plus separate injection detection: temporal consistency, material/texture, depth/reflectance, rPPG coherence, document/face results, device integrity, network risk, velocity and account links. Low risk passes; uncertainty retries or gets human review; strong attacks fail and are rate-limited. “Signal unavailable” never equals “fraud.”

Leading vendors expose useful session/SDK/webhook patterns, but core models remain proprietary. Procurement needs independent PAD scope/version, document coverage, demographic error evidence, injection/deepfake tests, deletion SLA, data regions/subprocessors, accessibility and a representative-device red-team POC. “Multi-layered” is not a test result.

Biometric privacy is a system requirement. UK biometric recognition normally needs an Article 6 basis and separate Article 9 condition; explicit consent is often appropriate but must meet the consent standard. Complete a DPIA, provide alternatives/appeals, minimize fields, keep raw media briefly, prohibit logging copies and make provider deletion observable. Retention must be necessary and documented.

After proofing, passkeys reduce account takeover. WebAuthn gives the service an RP-scoped public key; device biometrics remain local. The successful ceremony authorizes the normal short-lived JWT session. Weak email/SMS recovery must not bypass passkeys.

Recommended delivery sequence:

1. Define the exact assurance claim, legal basis, alternatives, retention and risk appetite.
2. Run a provider RFP and adversarial POC; choose on evidence, not pass-rate marketing.
3. Integrate provider-direct capture, server-created sessions, signed webhooks and minimal result storage.
4. Add deletion evidence, accessible fallbacks, manual review/appeals and fraud velocity controls.
5. Add passkeys and measured risk-based step-up.
6. Add custom signals only after independent evaluation and sustained attack testing.

The central principle is simple: outsource the biometric arms race, retain control of product policy and privacy, and never mistake one clever signal for proof of a genuine person.

Full technical blueprint: [phase-1-world-class-verification-blueprint.md](./phase-1-world-class-verification-blueprint.md)
