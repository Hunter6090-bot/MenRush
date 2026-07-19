import * as Sentry from '@sentry/node';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(JWT_PATTERN, '[redacted-token]')
    .replace(UUID_PATTERN, '[redacted-id]');
}

const dsn = String(process.env.SENTRY_DSN || '').trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      event.user = undefined;
      event.request = undefined;
      event.breadcrumbs = undefined;
      event.extra = undefined;
      event.contexts = undefined;
      if (event.message) event.message = redactSensitiveText(event.message);
      for (const value of event.exception?.values ?? []) {
        if (value.value) value.value = redactSensitiveText(value.value);
      }
      return event;
    },
  });
}

export { Sentry };
