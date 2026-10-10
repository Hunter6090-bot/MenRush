export function extractApiErrorMessage(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { error?: unknown } } }).response?.data;
    if (typeof data?.error === 'string' && data.error.trim().length > 0) {
      return data.error.trim();
    }
  }
  return null;
}

/**
 * True when register failed only because the referral code is unknown or
 * malformed. A referral never gates sign up, so the caller retries without it.
 */
export function isInvalidReferralError(err: unknown): boolean {
  const apiError = extractApiErrorMessage(err);
  return !!apiError && /referral code is not valid/i.test(apiError);
}

export const REFERRAL_IGNORED_NOTE = "That referral link didn't work, but you can still join free.";

const REGISTER_DOB_CODES = new Set(['date_of_birth_required', 'date_of_birth_invalid', 'under_18']);

export function registerErrorMessage(err: unknown): {
  message: string;
  isDuplicateEmail?: boolean;
} {
  // Date of birth refusals come as { error: code, message } with a friendly message.
  const data =
    typeof err === 'object' && err !== null && 'response' in err
      ? (err as { response?: { data?: { error?: unknown; message?: unknown } } }).response?.data
      : undefined;
  if (
    data &&
    typeof data.error === 'string' &&
    REGISTER_DOB_CODES.has(data.error) &&
    typeof data.message === 'string' &&
    data.message.trim()
  ) {
    return { message: data.message.trim() };
  }
  const apiError = extractApiErrorMessage(err);
  if (apiError) {
    if (/email already exists/i.test(apiError)) {
      return {
        message: 'An account with this email already exists. Sign in or reset your password.',
        isDuplicateEmail: true,
      };
    }
    return { message: apiError };
  }

  if (typeof err === 'object' && err !== null && 'message' in err) {
    const rawMsg = (err as { message?: unknown }).message;
    if (typeof rawMsg === 'string' && rawMsg.trim().length > 0 && !/^request failed with status code/i.test(rawMsg.trim())) {
      return { message: rawMsg.trim() };
    }
  }

  return { message: 'Registration failed. Please try again.' };
}

export function loginErrorMessage(err: unknown): string {
  const response =
    typeof err === 'object' && err !== null && 'response' in err
      ? (err as { response?: { status?: number; data?: { error?: unknown } } }).response
      : undefined;

  const apiError = extractApiErrorMessage(err);

  if (apiError === 'Invalid credentials') {
    return 'Email or password is incorrect. Check both, or use Forgot password.';
  }
  if (apiError && /confirm your email/i.test(apiError)) {
    return apiError;
  }
  if (apiError === 'Too many attempts, please try again in 15 minutes') {
    return apiError;
  }
  if (apiError) {
    return apiError;
  }

  // SPA HTML / 405 when Vercel rewrites are broken — not a bad password.
  if (response?.status === 405 || response?.status === 404) {
    return 'Sign-in service is temporarily unavailable. Try again in a moment.';
  }

  return 'Could not reach the server. Check your connection and try again.';
}