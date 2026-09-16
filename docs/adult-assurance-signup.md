# Signup: mandatory age-estimation selfie, optional ID

Production registration requires a one-time adult-assurance token. Self-declared DOB, a plain liveness approval, an SDK completion event, or a missing provider result cannot award adult access. ID verification remains optional and alone awards the Verified badge.

## Provider setup required before release

Veriff Age Estimation is a separate integration from Document + Selfie ID verification. A session feature flag cannot turn IDV into Age Estimation.

- Configure a live **Age Estimation** integration with liveness in Veriff Station, confirming its capture flow and age policy with Veriff.
- Set `VERIFF_AGE_ESTIMATION_API_KEY` and `VERIFF_AGE_ESTIMATION_SHARED_SECRET` in Railway. These must belong to the age integration, not the ID integration.
- Set `VERIFF_AGE_ESTIMATION_API_BASE` if Veriff supplies a different base URL. Default is `https://stationapi.veriff.com/v1`.
- Keep `VERIFF_API_KEY` and `VERIFF_SHARED_SECRET` for optional ID.
- Point both decision webhooks at `https://menrush.com/api/verify/veriff/webhook` (or the existing backend equivalent). The handler validates each against its own key and secret and accepts it only for the matching session kind.
- Production always requires the age check. `ADULT_ASSURANCE_SIGNUP_REQUIRED=false` is only a development/test override after this repair.
- Do not release the production gate before the age integration is provisioned and tested; this would block signup again. The readiness endpoint reports `available` separately from `required`.

Veriff documentation: https://devdocs.veriff.com/docs/age-estimation

## Flow

1. Enter account details.
2. Complete Veriff selfie capture. An authenticated approved decision must contain age evidence at least 18. Missing/invalid age evidence does not pass. An age estimate is not a guarantee of exact age; confirm the appropriate deployment threshold with Veriff before enabling the product.
3. Optionally add ID for the Verified badge, or skip ID and create the account.
4. Registration atomically redeems the latest unexpired token. ID status polling can rotate it, so the form fetches a fresh token immediately before completion.

Unknown, pending, cancelled and rejected results never become adult passes. No raw selfie or ID images are stored by this flow. Existing accounts are not reclassified by this patch.

## Validation and release check

`npm --prefix backend run build`
`npm --prefix backend run test:adult-assurance`
`npm --prefix backend run test:veriff`
`npm --prefix frontend test -- --run src/components/AdultAssuranceFlow.test.tsx`
`npm --prefix frontend run build`

Before production release, use a Veriff test integration to verify adult, underage, missing-age, cancelled, delayed-decision and ID-skip cases, then confirm a live age-only session actually asks only for a selfie. No test fixture flags may be enabled in production.

No database migration is added; existing migrations 058 and 059 are required.
