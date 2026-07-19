import { test } from '@playwright/test';

test.describe('authenticated smoke placeholders', () => {
  test('verified member can render discovery with GPS', async () => {
    test.skip(
      true,
      'Requires a seeded verified user, isolated API environment, and a deterministic geolocation fixture.',
    );
  });

  test('member can submit native ID + selfie verification', async () => {
    test.skip(
      true,
      'Requires a disposable unverified seeded user and deterministic ID/selfie fixtures.',
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
