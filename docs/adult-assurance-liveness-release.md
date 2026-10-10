# Mandatory adult assurance and liveness — review requirements

The existing release PR gates signup and existing-account recovery independently of the optional ID badge. This follow-up requires evidence version 2, rejects fixtures at redemption and access, and protects raw uploads and display thumbnails with viewer/path-bound signed grants and current age checks. Unauthenticated raw upload links no longer work. API response serialization signs local upload paths for the requesting viewer; private album/message service authorization remains required.

## Provider contract blocker

Veriff documentation describes an approved/9001 Age Estimation decision and numeric estimatedAge, but does not document a separate liveness result in that payload. Do not invent one or treat estimated age alone as proof of liveness. Before activation obtain written confirmation and sandbox evidence that approved decisions for the specific hosted integration include successful liveness and spoof rejection. If that contract cannot be confirmed, this integration must remain unavailable and needs a separately authenticated liveness flow.

Only after that review set VERIFF_AGE_ESTIMATION_LIVENESS_CONTRACT=approved-includes-liveness-v1 alongside the distinct API key, secret and HTTPS API base. This deployment setting is an operator attestation, not a provider response. The integration key/base and contract version are hashed into each new session; decisions cannot approve sessions created without that contract or under a different integration. Existing approvals are not upgraded. The numeric age minimum remains 18; provider accuracy/threshold policy needs owner/provider review.

Official references: https://devdocs.veriff.com/docs/age-estimation and https://devdocs.veriff.com/docs/biometric-liveness .

## Migrations

Renumber the unshipped 067_mandatory_age_evidence.sql to 069_mandatory_age_evidence.sql, preserving 067 for the open invoice PR and 068 for existing Verotel work. Add 070_age_liveness_contract.sql in both migration directories. The migrator tracks full filenames; 069 uses idempotent column additions for any private staging database that already applied old 067. Version 1 approvals require a new session. Do not run production migrations in this task.

## Deployment and validation boundaries

Production still reported required:false on 2 October 2026. No provider biometric flow, physical-device test, production migration or deployment is performed here. This branch is the existing combined release PR baseline, not latest main; reconcile subsequent production changes before release. Purge previously public upload/thumbnail CDN caches when deploying. Signed media grants expire; existing socket payloads or clients retaining raw upload paths need browser validation before release. A frontend preview alone cannot establish backend enforcement.

## Local validation

Frontend and backend builds pass. Chromium/WebKit/Firefox compatibility: 81/81 passed. Backend offline age contract, Veriff regressions and nine security checks pass. The private PostgreSQL suite exercises signed webhook handling, token ownership/redemption, numeric age rejection, legacy and fixture rejection, HTTP/media gates and the production Socket.IO middleware (using a socket test double, not a real deployed transport). Thumbnail transformation is stubbed while its real authorization route is exercised.
