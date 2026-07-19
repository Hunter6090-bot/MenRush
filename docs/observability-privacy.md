# Observability and Analytics Privacy Contract

Both integrations are optional and gracefully no-op when their environment keys are absent.

## Never collect

- Precise or approximate coordinates, addresses, or location history
- Sexual orientation, preferences, tribes, interests, filters, or profile attributes
- Message, room, support, or contact-form contents
- Photos, audio, video, filenames, captions, IDs, verification documents, or rejection reasons
- Email addresses, names, auth tokens, cookies, payment data, or other direct identifiers
- Session replay, DOM recording, autocapture, or full page URLs

## Statsig

The browser SDK uses a random ID stored only for the current browser session. Stable IDs, cookies,
page URLs, web analytics autocapture, and session replay are disabled or not installed. Event
metadata is filtered through a per-event allowlist in code. Feature gates default off when Statsig
is not configured or unavailable.

Allowed events:

| Event | Allowed metadata |
| --- | --- |
| `landing_viewed` | `surface` |
| `waitlist_attempted` | `transport` |
| `waitlist_succeeded` | `transport`, `already_subscribed` |
| `waitlist_failed` | `stage`, `transport` |
| `verification_transition` | coarse `state` only |
| `location_permission_outcome` | `granted`, `denied`, `unavailable`, or `unsupported` |
| `first_discovery_load` | success/failure and a coarse result-count bucket |
| `first_message_success` | message kind and product surface only |

## Sentry

Frontend and backend Sentry SDKs have default PII collection disabled and performance tracing set
to zero. Before-send filters remove request data, query strings, cookies, headers, breadcrumbs,
user identity, extras, and contexts. Error messages are scrubbed for emails, JWTs, and UUIDs.
Session replay is not installed.
