export function loginErrorMessage(err: unknown): string {
  const response =
    typeof err === 'object' && err !== null && 'response' in err
      ? (err as { response?: { status?: number; data?: { error?: unknown } } }).response
      : undefined;

  const apiError =
    typeof response?.data?.error === 'string' ? response.data.error : null;

  if (apiError === 'Invalid credentials') {
    return 'Email or password is incorrect. Check both, or use Forgot password.';
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