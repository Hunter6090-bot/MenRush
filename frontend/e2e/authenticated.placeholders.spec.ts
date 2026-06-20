import { test } from '@playwright/test';

test.describe('authenticated smoke placeholders', () => {
  test('verified member can render discovery with GPS', async () => {
    test.skip(
      true,
      'Requires a seeded verified user, isolated API environment, and a deterministic geolocation fixture.',
    );
  });

  test('member can enter the Stripe Identity flow', async () => {
    test.skip(
      true,
      'Requires Stripe test-mode keys, webhook handling, and a disposable unverified seeded user.',
    );
  });

  test('matched members can open messages', async () => {
    test.skip(
      true,
      'Requires two seeded verified users with an existing match and side-effect-safe message fixtures.',
    );
  });

  test('member can report another profile', async () => {
    test.skip(
      true,
      'Requires disposable seeded users and an isolated database where report records can be reset.',
    );
  });

  test('member can block and unblock another profile', async () => {
    test.skip(
      true,
      'Requires disposable seeded users and an isolated database where block state can be reset.',
    );
  });
});
