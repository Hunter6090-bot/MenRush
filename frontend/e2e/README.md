# Browser smoke tests

The default suite is intentionally safe to run against a local frontend or a
deployed read-only target. It does not submit credentials, personal data,
waitlist entries, contact messages, reports, blocks, or outbound email.

## Run locally

```sh
npm run test:e2e:install
npm run test:e2e
```

Playwright starts Vite on `http://127.0.0.1:4173`. To test an already deployed
target without starting Vite:

```sh
PLAYWRIGHT_BASE_URL=https://example.test npm run test:e2e
```

Do not point authenticated tests at production. Keep credentials and storage
state files outside the repository and provide them through CI secrets or
ephemeral test setup.

## Authenticated-flow setup contract

The skipped placeholders require an isolated environment with:

- disposable seeded users, including verified and unverified states;
- deterministic geolocation permission and coordinates;
- Stripe Identity test-mode keys plus webhook processing;
- a pre-seeded match for messaging checks;
- resettable report and block records;
- outbound email disabled or redirected to a test sink.

Implement each placeholder only when its fixtures can be created and cleaned up
without touching real members or triggering external communications.
