/**
 * Signup adult-assurance dual path (Al 2026-09-12 / #97).
 * A Intro → B Liveness → C Optional ID upsell → D ID (optional) → register
 * E Underage handled by caller → /register/underage
 *
 * Face copy is intentionally short. Legal: not “all ID-verified”, no OSA claim,
 * Verified tick = opted into ID only. We do not store ID documents.
 */
import React, { useRef, useState } from 'react';
import { authAPI } from '../api/client';
import { PulseRing } from './PulseRing';
import { VerifiedBadge } from './VerifiedBadge';
import { launchVeriffInContext, type VeriffFrameHandle } from '../lib/veriff';
import {
  publicErrorClass,
  publicMutedCopyClass,
  publicPrimaryButtonClass,
  publicSecondaryButtonClass,
} from '../lib/publicStyles';

/** Short face strings for Product / Al skim. */
export const ADULT_ASSURANCE_COPY = {
  introTitle: 'Quick age check',
  introBody:
    'Selfie confirms you’re 18+ and real. Optional ID adds a Verified tick. We don’t store your ID — Veriff checks it.',
  introCta: 'Start selfie check',
  livenessProgress: 'Checking you’re 18+…',
  livenessSuccess: '18+ confirmed.',
  upsellTitle: 'Add ID for Verified?',
  upsellBody: 'Optional. Skip to stay discreet. We don’t keep your document.',
  upsellYes: 'Add ID',
  upsellSkip: 'Skip',
  idProgress: 'Checking ID…',
  idSuccess: 'Verified tick earned.',
  idFail: 'ID check didn’t pass. You can skip and finish signup.',
  failGeneric: 'Age check didn’t pass. MenRush is 18+ only. Try again with your own selfie.',
  cancel: 'Age check cancelled.',
  timeout: 'Age check timed out. Try again.',
} as const;

const ADULT_POLL_MS = 2000;
const ADULT_POLL_MAX_MS = 120_000;

export type AdultAssurancePhase =
  | 'intro'
  | 'liveness'
  | 'liveness_ok'
  | 'upsell'
  | 'id'
  | 'id_ok'
  | 'done';

export type AdultAssuranceResult =
  | { token: string; idVerified: boolean }
  | { underage: true }
  | { error: string; cancelled?: boolean };

type Props = {
  fixtureAllowed: boolean;
  onComplete: (result: AdultAssuranceResult) => void;
  onCancel: () => void;
};

function fixtureOutcomeFromQuery():
  | 'underage'
  | 'adult'
  | 'adult_with_id'
  | 'declined'
  | 'failed'
  | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('adultFixture');
  if (!raw) return null;
  if (raw === 'underage' || raw === 'adult' || raw === 'adult_with_id' || raw === 'declined' || raw === 'failed') {
    return raw;
  }
  // Legacy alias
  if (raw === 'missing_dob') return 'failed';
  return 'adult';
}

async function pollLiveness(
  sessionId: string,
  signal: { cancelled: boolean },
): Promise<AdultAssuranceResult & { sessionId?: string }> {
  const startedAt = Date.now();
  while (!signal.cancelled && Date.now() - startedAt < ADULT_POLL_MAX_MS) {
    const { data } = await authAPI.adultAssuranceStatus(sessionId);
    if (data.underage || data.status === 'underage') return { underage: true };
    if (data.status === 'passed' && data.assurance_token) {
      return {
        token: data.assurance_token,
        idVerified: Boolean(data.id_verified),
        sessionId,
      } as AdultAssuranceResult & { sessionId: string };
    }
    if (
      data.status === 'declined' ||
      data.status === 'expired' ||
      data.status === 'abandoned' ||
      data.status === 'failed'
    ) {
      return { error: ADULT_ASSURANCE_COPY.failGeneric };
    }
    await new Promise((r) => setTimeout(r, ADULT_POLL_MS));
  }
  return { error: ADULT_ASSURANCE_COPY.timeout };
}

async function pollId(
  parentSessionId: string,
  signal: { cancelled: boolean },
): Promise<{ ok: boolean; idVerified: boolean; error?: string }> {
  const startedAt = Date.now();
  while (!signal.cancelled && Date.now() - startedAt < ADULT_POLL_MAX_MS) {
    const { data } = await authAPI.adultAssuranceStatus(parentSessionId);
    if (data.id_verified) return { ok: true, idVerified: true };
    if (
      data.id_status === 'declined' ||
      data.id_status === 'expired' ||
      data.id_status === 'abandoned' ||
      data.id_status === 'failed' ||
      data.id_status === 'underage'
    ) {
      return { ok: false, idVerified: false, error: ADULT_ASSURANCE_COPY.idFail };
    }
    await new Promise((r) => setTimeout(r, ADULT_POLL_MS));
  }
  return { ok: false, idVerified: false, error: ADULT_ASSURANCE_COPY.timeout };
}

export function AdultAssuranceFlow({ fixtureAllowed, onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState<AdultAssurancePhase>('intro');
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null);
  const frameRef = useRef<VeriffFrameHandle | null>(null);
  const cancelRef = useRef({ cancelled: false });

  const runVeriffFrame = (sessionUrl: string, sessionId: string) =>
    new Promise<void>((resolve, reject) => {
      let settled = false;
      frameRef.current = launchVeriffInContext(sessionUrl, {
        onSubmitted: () => {
          if (settled) return;
          settled = true;
          frameRef.current?.close();
          frameRef.current = null;
          void authAPI.markAdultAssuranceSubmitted(sessionId).catch(() => undefined);
          resolve();
        },
        onCanceled: () => {
          if (settled) return;
          settled = true;
          frameRef.current = null;
          reject(new Error(ADULT_ASSURANCE_COPY.cancel));
        },
      });
    });

  const finish = (idVerified: boolean) => {
    if (!token) {
      onComplete({ error: ADULT_ASSURANCE_COPY.failGeneric });
      return;
    }
    setPhase('done');
    onComplete({ token, idVerified });
  };

  const startLiveness = async () => {
    setError('');
    setPhase('liveness');
    cancelRef.current.cancelled = false;
    try {
      const { data: started } = await authAPI.startAdultAssurance();
      setLivenessSessionId(started.sessionId);

      const fixture = fixtureAllowed ? fixtureOutcomeFromQuery() : null;
      if (fixture) {
        const fix = await authAPI.adultAssuranceFixture({
          sessionId: started.sessionId,
          outcome: fixture,
        });
        if (fix.data.adultStatus === 'underage' || fixture === 'underage') {
          onComplete({ underage: true });
          return;
        }
        if (fix.data.adultStatus === 'declined' || fix.data.adultStatus === 'failed' || fixture === 'declined' || fixture === 'failed') {
          setError(ADULT_ASSURANCE_COPY.failGeneric);
          setPhase('intro');
          return;
        }
        if (!fix.data.assurance_token) {
          setError(ADULT_ASSURANCE_COPY.failGeneric);
          setPhase('intro');
          return;
        }
        setToken(fix.data.assurance_token);
        setPhase('liveness_ok');
        // Brief success beat, then upsell (skip upsell if fixture already did ID).
        await new Promise((r) => setTimeout(r, 1200));
        if (fixture === 'adult_with_id' || fix.data.id_verified) {
          setPhase('id_ok');
          await new Promise((r) => setTimeout(r, 2200));
          onComplete({ token: fix.data.assurance_token, idVerified: true });
          return;
        }
        setPhase('upsell');
        return;
      }

      await runVeriffFrame(started.sessionUrl, started.sessionId);
      const polled = await pollLiveness(started.sessionId, cancelRef.current);
      if ('underage' in polled) {
        onComplete({ underage: true });
        return;
      }
      if ('error' in polled) {
        setError(polled.error);
        setPhase('intro');
        return;
      }
      setToken(polled.token);
      setPhase('liveness_ok');
      await new Promise((r) => setTimeout(r, 700));
      setPhase('upsell');
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : ADULT_ASSURANCE_COPY.failGeneric;
      setError(msg);
      setPhase('intro');
    }
  };

  const startOptionalId = async () => {
    if (!livenessSessionId || !token) {
      finish(false);
      return;
    }
    setError('');
    setPhase('id');
    cancelRef.current.cancelled = false;
    try {
      const { data: idSession } = await authAPI.startAdultAssuranceId(livenessSessionId);
      await runVeriffFrame(idSession.sessionUrl, idSession.sessionId);
      const result = await pollId(livenessSessionId, cancelRef.current);
      if (result.idVerified) {
        setPhase('id_ok');
        await new Promise((r) => setTimeout(r, 900));
        finish(true);
        return;
      }
      setError(result.error || ADULT_ASSURANCE_COPY.idFail);
      setPhase('upsell');
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : ADULT_ASSURANCE_COPY.idFail;
      setError(msg);
      setPhase('upsell');
    }
  };

  const handleCancel = () => {
    cancelRef.current.cancelled = true;
    frameRef.current?.close();
    frameRef.current = null;
    onCancel();
  };

  return (
    <div
      className="flex flex-col gap-5"
      data-testid="adult-assurance-flow"
      data-phase={phase}
    >
      {phase === 'intro' ? (
        <>
          <h2
            className="m-0 text-[22px] font-extrabold tracking-tight text-[#F0E0C0]"
            data-testid="adult-assurance-intro-title"
          >
            {ADULT_ASSURANCE_COPY.introTitle}
          </h2>
          <p className={`${publicMutedCopyClass} m-0`} data-testid="adult-assurance-intro-body">
            {ADULT_ASSURANCE_COPY.introBody}
          </p>
          {error ? <p className={publicErrorClass}>{error}</p> : null}
          <button
            type="button"
            className={publicPrimaryButtonClass}
            onClick={() => void startLiveness()}
            data-testid="adult-assurance-intro-cta"
          >
            {ADULT_ASSURANCE_COPY.introCta}
          </button>
          <button type="button" className={publicSecondaryButtonClass} onClick={handleCancel}>
            Back
          </button>
        </>
      ) : null}

      {phase === 'liveness' ? (
        <div className="flex flex-col items-center gap-4 py-6" data-testid="adult-assurance-liveness">
          <PulseRing size={28} />
          <p className="m-0 text-[17px] font-bold text-[#F0E0C0]">{ADULT_ASSURANCE_COPY.livenessProgress}</p>
        </div>
      ) : null}

      {phase === 'liveness_ok' ? (
        <div className="flex flex-col items-center gap-3 py-6" data-testid="adult-assurance-liveness-ok">
          <p className="m-0 text-[17px] font-bold text-[#C4832A]">{ADULT_ASSURANCE_COPY.livenessSuccess}</p>
        </div>
      ) : null}

      {phase === 'upsell' ? (
        <>
          <h2
            className="m-0 text-[22px] font-extrabold tracking-tight text-[#F0E0C0]"
            data-testid="adult-assurance-upsell-title"
          >
            {ADULT_ASSURANCE_COPY.upsellTitle}
          </h2>
          <p className={`${publicMutedCopyClass} m-0`} data-testid="adult-assurance-upsell-body">
            {ADULT_ASSURANCE_COPY.upsellBody}
          </p>
          {error ? <p className={publicErrorClass}>{error}</p> : null}
          <button
            type="button"
            className={publicPrimaryButtonClass}
            onClick={() => void startOptionalId()}
            data-testid="adult-assurance-upsell-yes"
          >
            {ADULT_ASSURANCE_COPY.upsellYes}
          </button>
          <button
            type="button"
            className={publicSecondaryButtonClass}
            onClick={() => finish(false)}
            data-testid="adult-assurance-upsell-skip"
          >
            {ADULT_ASSURANCE_COPY.upsellSkip}
          </button>
        </>
      ) : null}

      {phase === 'id' ? (
        <div className="flex flex-col items-center gap-4 py-6" data-testid="adult-assurance-id">
          <PulseRing size={28} />
          <p className="m-0 text-[17px] font-bold text-[#F0E0C0]">{ADULT_ASSURANCE_COPY.idProgress}</p>
        </div>
      ) : null}

      {phase === 'id_ok' ? (
        <div className="flex flex-col items-center gap-3 py-6" data-testid="adult-assurance-id-ok">
          <VerifiedBadge size="lg" />
          <p className="m-0 text-[17px] font-bold text-[#C4832A]">{ADULT_ASSURANCE_COPY.idSuccess}</p>
        </div>
      ) : null}
    </div>
  );
}

export default AdultAssuranceFlow;
