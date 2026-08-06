# MenRush Verification — Phase 2 Provider Decision

**Decision date:** 25 July 2026  
**Status:** Architecture decision for sandbox proof of concept; not production approval  
**Recommended pilot:** Persona  
**Fallback:** Veriff

## Decision in one sentence

Pilot Persona behind a MenRush-owned provider interface because it is the closest public fit for all three MenRush trust layers while disclosing the least identity data to MenRush; keep Veriff as a tested fallback and do not ship either provider until privacy, security, accuracy, accessibility and commercial gates pass.

## What this decision does not mean

- It does not make government ID mandatory.
- It does not make verification a Premium feature.
- It does not let a browser callback award a badge.
- It does not permit MenRush to store raw ID or selfie media.
- It does not approve a provider's marketing claims as fact.
- It does not approve production until contracts, a DPIA and a representative-device proof of concept are complete.

## The MenRush policy being implemented

| Layer | User promise | Requirement | Public result |
|---|---|---|---|
| Adult confirmed | “MenRush confirmed this account meets the 18+ requirement.” | Mandatory before access to the adult service | Adult confirmed |
| Authentic person | “A live person completed a real-time check.” | Optional | Authentic person |
| Identity checked | “A government ID was privately checked against a live person.” | Optional | Identity checked |

These are independent of Premium. A user can be Adult confirmed without showing MenRush their legal name. An Authentic person badge must not imply legal identity. Identity checked must not publish a legal name, document number, address, nationality, date of birth or exact age.

## Why Persona is the recommended pilot

Persona's public documentation describes:

- a UK-specific 18+ claim and a claim-only Relay model;
- live human and verified human presence claims;
- selfie liveness and optional government ID plus face comparison;
- embedded and hosted web flows with device handoff;
- short, single-use links suitable for QR codes;
- signed webhooks;
- API/dashboard redaction and automated retention;
- a default processor policy that says verification data can be deleted once an outcome is determined.

That combination maps unusually well to MenRush's layered model. Most importantly, Persona Relay is designed to return an eligibility claim without returning the underlying identity data. That is a stronger default for an app where identity evidence could expose a user's connection to a sensitive service.

Official sources:

- [Persona Relay overview](https://docs.withpersona.com/2022-09-01/relay)
- [Persona Relay claim schemas](https://docs.withpersona.com/relay-schemas)
- [Persona verification types](https://docs.withpersona.com/verification-types)
- [Persona inquiry sessions and device handoff](https://docs.withpersona.com/inquiry-sessions)
- [Persona one-time links](https://docs.withpersona.com/resuming-inquiries)
- [Persona webhook/redaction event](https://docs.withpersona.com/2025-12-08/api-reference/webhooks/inquiry-events/webhook-inquiry-redacted)
- [Persona processor privacy policy](https://withpersona.com/legal/privacy-policy)
- [Persona pricing](https://withpersona.com/pricing)

## Why Veriff remains the fallback

Veriff has a simpler packaged identity-verification flow, mature SDK session URLs, assisted capture, document-plus-selfie IDV, liveness, age estimation, signed decision webhooks and polling fallback. It may win on conversion, capture quality, document coverage, support or commercial terms in the proof of concept.

Its public default enterprise retention, however, is not acceptable for MenRush without a written override: Veriff describes 90 days in the service followed by archive retention for standard identity verification. Its DPA says earlier deletion can be agreed or requested, so this is a contract gate rather than an automatic rejection.

Official sources:

- [Veriff SDK flow](https://devdocs.veriff.com/docs/quick-guide-of-idv-using-the-sdks-1)
- [Veriff session creation](https://devdocs.veriff.com/apidocs/v1sessions)
- [Veriff decision webhook](https://devdocs.veriff.com/docs/decision-webhook)
- [Veriff webhook security](https://devdocs.veriff.com/docs/webhooks-guide)
- [Veriff biometric liveness](https://devdocs.veriff.com/docs/biometric-liveness)
- [Veriff age estimation](https://devdocs.veriff.com/docs/age-estimation)
- [Veriff data retention](https://www.veriff.com/data-retention/ver-vdr-2301)
- [Veriff DPA](https://www.veriff.com/data-processing-addendum/ver-dpa-2304)

## Weighted scorecard

Scores are provisional assessments of public documentation, not laboratory results. Each category is scored from 1 to 5 and must be replaced by evidence from the sandbox pilot and contract review.

| Criterion | Weight | Persona | Veriff | Reason |
|---|---:|---:|---:|---|
| Fits all three trust layers | 20% | 5 | 4 | Persona documents UK 18+, humanness and ID/selfie paths. Veriff documents age estimation, biometric liveness and IDV, but as separate integrations. |
| Data minimisation | 20% | 5 | 3 | Persona Relay returns claim results and says underlying verification data is deleted. Veriff IDV decisions can include verified identity fields unless the integration and contract restrict them. |
| Deletion and retention control | 15% | 5 | 2 | Persona documents redaction, automated retention and processor-directed deletion. Veriff's public enterprise default is materially longer, although contract overrides are possible. |
| Capture and anti-fraud quality | 15% | 4 | 5 | Both make strong claims; Veriff's packaged assisted-capture focus is a likely advantage. This must be tested, not assumed. |
| Cross-device experience | 10% | 5 | 4 | Persona explicitly documents device handoff and one-time QR-friendly links. Veriff session URLs work cross-device, but MenRush would own more handoff behaviour. |
| Integration flexibility | 8% | 5 | 4 | Persona Dynamic Flows, Workflows and inquiry APIs are highly configurable. Veriff is simpler but more product-integration oriented. |
| UK/EU privacy posture | 7% | 3 | 4 | Persona documents US and Germany data centres and international transfers. Veriff says default storage is AWS Ireland. Contract details remain decisive. |
| Public commercial clarity | 5% | 4 | 2 | Persona publishes a starting platform price; usage and required features still need a quote. Veriff requires commercial confirmation. |
| **Weighted total** | **100%** | **4.66 / 5** | **3.55 / 5** | Persona wins the architecture decision; the POC can still overturn it. |

## Non-negotiable procurement gates

The provider must agree in writing to:

1. MenRush receives only the minimum claim/result needed for each tier.
2. No provider model training or unrelated product development using MenRush evidence.
3. Raw ID, selfie, video and biometric templates are deleted immediately after the decision where technically possible, and no later than the agreed short retention window.
4. Backups are put beyond use and deleted on a documented schedule.
5. Deletion is exposed by event, API state or auditable report.
6. UK/EEA transfer mechanisms, processing locations and every relevant subprocessor are disclosed.
7. A current DPA, security pack, breach-notification SLA and assistance with data-subject requests are provided.
8. MenRush may measure error rates and conversion by device and broad demographic cohort without receiving unnecessary identity data.
9. Users have an accessible alternative and an appeal path.
10. Contract termination includes verifiable deletion.

## Proof-of-concept pass/fail gates

Run both Persona and Veriff if sandbox access can be obtained without a large commitment. Persona remains the default if only one can be piloted first.

### Required test matrix

- Current iPhone Safari and Chrome.
- Current Android Chrome and Samsung Internet.
- Desktop Chrome, Safari, Firefox and Edge.
- Older or low-memory phones representative of the intended user base.
- Weak light, glare, blur, damaged document, poor network and camera denial.
- Passport, driving licence and national ID samples from the launch countries.
- Desktop-to-phone QR handoff, refresh, expired link and duplicate scan.
- Screen replay, printed face, virtual camera, prerecorded video and obvious document copy attacks.
- Keyboard-only navigation, screen reader, zoom, reduced motion and colour contrast.

### Launch thresholds

Exact numerical thresholds must be agreed before the pilot starts. At minimum:

- no client-side-only approval path;
- no raw media in MenRush application logs, analytics, error reporting or database;
- every accepted webhook signature verified;
- duplicate and out-of-order events produce the same final result;
- phone completion updates desktop through the backend;
- deletion completes and is observable;
- false rejection and abandonment are reviewed by device and cohort;
- the fallback/appeal path is usable;
- a provider outage does not lock existing adult-confirmed users out of unrelated app features.

## Commercial comparison

Persona publishes a starting Essential plan and a 12-month minimum, but its public list price is not in GBP and is therefore not a usable MenRush budget. Obtain a written GBP quote. Features such as Relay, age assurance, humanness, workflows, UK configuration and volume usage may require a different plan or quote.

Veriff's public technical material does not establish a reliable MenRush unit price. Obtain written pricing for age estimation, biometric liveness, document-plus-selfie IDV, retries, manual review, data regions, deletion and support.

The financial model must use:

`monthly cost = platform fee + successful checks + failed attempts + retries + manual reviews + add-ons + support`

Do not compare vendors using only a headline “per verification” number.

## Final Phase 2 decision

Proceed with a Persona sandbox proof of concept behind a provider-neutral MenRush interface. Treat Veriff as a live fallback candidate, not a discarded option. No production launch decision is made until the proof of concept, DPIA, contract, deletion test and accessibility review pass.
