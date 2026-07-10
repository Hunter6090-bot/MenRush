export function loginErrorMessage(err: unknown): string {
  const apiError =
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { error?: unknown } } }).response?.data?.error === 'string'
      ? (err as { response: { data: { error: string } } }).response.data.error
      : null;

  if (apiError === 'Invalid credentials') {
    return 'Email or password is incorrect. Check both, or use Forgot password.';
  }
  if (apiError === 'Too many attempts, please try again in 15 minutes') {
    return apiError;
  }
  if (apiError) {
    return apiError;
  }

  return 'Could not reach the server. Check your connection and try again.';
}