import type { Page, Request } from '@playwright/test';

const SIDE_EFFECT_PATHS = [
  '/waitlist',
  '/contact',
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const ZOHO_WAITLIST_HOST = 'forms.zohopublic.com';

export async function guardAgainstSideEffects(page: Page) {
  const blockedRequests: string[] = [];
  const guardedPatterns = [
    ...SIDE_EFFECT_PATHS.map((path) => `**${path}`),
    `https://${ZOHO_WAITLIST_HOST}/**`,
  ];

  const isSideEffect = (request: Request) => {
    if (request.method() === 'GET' || request.method() === 'HEAD') return false;

    const url = new URL(request.url());
    return (
      url.hostname === ZOHO_WAITLIST_HOST ||
      SIDE_EFFECT_PATHS.some((path) => url.pathname.endsWith(path))
    );
  };

  await Promise.all(
    guardedPatterns.map((pattern) =>
      page.route(pattern, async (route) => {
        const request = route.request();
        if (isSideEffect(request)) {
          blockedRequests.push(`${request.method()} ${request.url()}`);
          await route.abort('blockedbyclient');
          return;
        }
        await route.continue();
      }),
    ),
  );

  return {
    expectNoSideEffects: () => blockedRequests,
  };
}
