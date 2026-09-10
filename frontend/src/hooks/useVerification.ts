import { useCallback, useEffect, useRef, useState } from 'react';
import { verifyAPI, type VerifyStatus } from '../api/verify';
import { useAuthStore } from './store';
import { useSocket } from './useSocket';
import { launchVeriffInContext, type VeriffFrameHandle } from '../lib/veriff';

export function useVerification() {
  const [status, setStatus] = useState<VerifyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setVerified = useAuthStore((state) => state.setVerified);
  const userId = useAuthStore((state) => state.user?.id);
  const socket = useSocket();
  const frame = useRef<VeriffFrameHandle | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const { data } = await verifyAPI.status();
      if (!mounted.current) return;
      setStatus(data);
      setVerified(data.status, data.is_verified);
      setError('');
    } catch {
      if (mounted.current) setError('Could not check your verification status. Please try again.');
    } finally {
      refreshing.current = false;
    }
  }, [setVerified]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const onDecision = () => { void refresh(); };
    window.addEventListener('focus', onDecision);
    document.addEventListener('visibilitychange', onVisible);
    socket?.on('verify:decision', onDecision);
    return () => {
      mounted.current = false;
      window.removeEventListener('focus', onDecision);
      document.removeEventListener('visibilitychange', onVisible);
      socket?.off('verify:decision', onDecision);
      frame.current?.close();
      frame.current = null;
    };
  }, [refresh, socket, userId]);

  useEffect(() => {
    if (status?.status !== 'pending' || status.is_verified) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [status?.status, status?.is_verified, refresh]);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      // The server owns resume URLs and checks that the session belongs to this user.
      const { data } = await verifyAPI.createVeriffSession();
      if (!mounted.current) return;
      frame.current = launchVeriffInContext(data.sessionUrl, {
        onSubmitted: () => {
          if (!mounted.current) return;
          busy.current = false;
          frame.current?.close();
          frame.current = null;
          setLoading(false);
          // Submission only updates progress. An authenticated provider decision awards the badge.
          void verifyAPI.submitVeriffSession().then(refresh).catch(() => {
            if (mounted.current) setError('Your check was submitted. We could not refresh its status yet.');
          });
        },
        onCanceled: () => {
          if (!mounted.current) return;
          busy.current = false;
          frame.current = null;
          setLoading(false);
          void refresh();
        },
      });
    } catch (err: unknown) {
      if (!mounted.current) return;
      const code = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      if (code === 'already_verified' || code === 'verification_pending') {
        await refresh();
      } else {
        setError(code === 'veriff_not_configured'
          ? 'Verification is temporarily unavailable. You can keep using MenRush and try again later.'
          : 'Could not open verification. Please try again.');
      }
      busy.current = false;
      setLoading(false);
    } finally {
      if (!mounted.current) busy.current = false;
    }
  }, [refresh]);

  return { status, loading, error, start, refresh };
}
