import * as Sentry from '@sentry/react';
import { redactSensitiveText, sanitizeRouteName } from './privacy';

const dsn = String(import.meta.env.VITE_SENTRY_DSN || '').trim();

export function initializeErrorReporting(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: String(import.meta.env.VITE_APP_ENV || import.meta.env.MODE),
    release: String(import.meta.env.VITE_APP_RELEASE || '').trim() || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      event.user = undefined;
      event.request = undefined;
      event.breadcrumbs = undefined;
      event.extra = undefined;
      event.contexts = undefined;
      event.transaction = sanitizeRouteName(event.transaction);

      if (event.message) event.message = redactSensitiveText(event.message);
      for (const value of event.exception?.values ?? []) {
        if (value.value) value.value = redactSensitiveText(value.value);
      }

      return event;
    },
  });
}

export { Sentry };
