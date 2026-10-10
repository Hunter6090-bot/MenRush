/**
 * Resolve JWT_SECRET for signing and verifying session tokens.
 * Missing is always fatal. In production, known insecure defaults are fatal too.
 * The value used for HMAC is the raw env string (same as main). Trim is only
 * for the empty and placeholder checks.
 */

const INSECURE_JWT_SECRET_PLACEHOLDERS = new Set([
  'your-secret-key',
  'your-secret-key-change-in-production',
  'your-secret-jwt-key-change-in-production',
]);

export function isInsecureJwtSecretPlaceholder(value: string): boolean {
  return INSECURE_JWT_SECRET_PLACEHOLDERS.has(value.trim().toLowerCase());
}

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.JWT_SECRET ?? '';
  const nodeEnv = (env.NODE_ENV ?? '').trim().toLowerCase();
  if (!raw.trim()) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (nodeEnv === 'production' && isInsecureJwtSecretPlaceholder(raw)) {
    throw new Error('JWT_SECRET is using an insecure default in production');
  }
  return raw;
}

export function assertJwtSecret(env: NodeJS.ProcessEnv = process.env): void {
  resolveJwtSecret(env);
}
