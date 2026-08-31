/**
 * Launch Veriff ID + selfie using the sessionUrl returned by
 * POST /api/verify/veriff/session.
 *
 * Final Identity checked badge is granted only by the Veriff decision webhook
 * (status=approved) — never by statusDone alone.
 */
import VeriffSdk from '@veriff/react-native-sdk';

export type VeriffLaunchResult =
  | { status: 'done' }
  | { status: 'canceled' }
  | { status: 'error'; error?: string };

export async function launchVeriffIdentityCheck(sessionUrl: string): Promise<VeriffLaunchResult> {
  if (!sessionUrl) {
    return { status: 'error', error: 'missing_session_url' };
  }

  const result = await VeriffSdk.launchVeriff({ sessionUrl });

  switch (result.status) {
    case VeriffSdk.statusDone:
      return { status: 'done' };
    case VeriffSdk.statusCanceled:
      return { status: 'canceled' };
    case VeriffSdk.statusError:
      return { status: 'error', error: String((result as { error?: string }).error ?? 'veriff_error') };
    default:
      return { status: 'error', error: 'unknown_status' };
  }
}
