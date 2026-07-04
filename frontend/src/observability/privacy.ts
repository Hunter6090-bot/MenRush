const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(JWT_PATTERN, '[redacted-token]')
    .replace(UUID_PATTERN, '[redacted-id]');
}

export function sanitizeRouteName(value: string | undefined): string | undefined {
  if (!value) return value;
  return redactSensitiveText(value).replace(/([?&](?:token|code|email|lat|lng|latitude|longitude)=)[^&]*/gi, '$1[redacted]');
}
