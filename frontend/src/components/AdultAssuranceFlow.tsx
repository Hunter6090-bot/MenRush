/**
 * Signup adult-assurance dual path (Al / Brand / Zoul / Legal 2026-09-12 / #97).
 * A Intro → B Veriff liveness (hosted) → C Optional ID upsell → D Veriff ID → register
 * E Underage → /register/underage
 *
 * Capture is Veriff-hosted (sessionUrl / SDK) only. No custom camera UI.
 * Legal: liveness = age gate only. Verified tick = optional ID. Not OSA / all-ID-verified.
 * Storage line: MenRush does not keep copies of your ID (Veriff processes as processor).
 * No em dashes in face copy.
 */
import React, { useEffect, useRef, useState } from 'react';
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

/** Short face strings for Product / Al / Brand / Legal skim. */
export const ADULT_ASSURANCE_COPY = {
  introTitle: 'Quick selfie',
  introBody: 'Confirms you are 18+ and real.',
  introHowTitle: 'How it works',
  introBullet1: 'Veriff opens a short selfie check.',
  introBullet2: 'Optional ID later for a Verified tick.',
  introNoIdCopies: 'MenRush does not keep copies of your ID.',
  introAgeNote: 'This is the age gate only. Verified is separate and optional.',
  introCta: 'Continue with Veriff',
  livenessProgress: 'Opening Veriff…',
  livenessSuccess: '18+ confirmed. Age check done.',
  upsellTitle: 'Want a Verified tick?',
  upsellBody:
    'Age check is done. Verified means optional ID only. MenRush does not keep copies of your ID.',
  upsellYes: 'Add ID with Veriff',
  upsellSkip: 'Skip',
  idProgress: 'Opening Veriff for ID…',
  idSuccess: 'Verified tick earned.',
  idSuccessNote: 'Separate from the age gate you already passed.',
  idFail: 'ID check did not pass. You can skip. Age check already done.',
  failGeneric: 'Age check did not pass. MenRush is 18+ only. Try again with your own selfie.',
  cancel: 'Age check cancelled.',
  timeout: 'Age check timed out. Try again.',
  /** Register form helper (before gate opens). */
  registerHelper:
    'Next: a Veriff selfie for 18+. Optional ID adds a Verified tick. MenRush does not keep copies of your ID.',
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
  onPhaseChange?: (phase: AdultAssurancePhase) => void;
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

export function AdultAssuranceFlow({
  fixtureAllowed,
  onComplete,
  onCancel,
  onPhaseChange,
}: Props) {
  const [phase, setPhase] = useState<AdultAssurancePhase>('intro');
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null);
  const frameRef = useRef<VeriffFrameHandle | null>(null);
  const cancelRef = useRef({ cancelled: false });

  const goPhase = (next: AdultAssurancePhase) => {
    setPhase(next);
    onPhaseChange?.(next);
  };

  useEffect(() => {
    onPhaseChange?.('intro');
  }, [onPhaseChange]);

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
    goPhase('done');
    onComplete({ token, idVerified });
  };

  const startLiveness = async () => {
    setError('');
    goPhase('liveness');
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
        if (
          fix.data.adultStatus === 'declined' ||
          fix.data.adultStatus === 'failed' ||
          fixture === 'declined' ||
          fixture === 'failed'
        ) {
          setError(ADULT_ASSURANCE_COPY.failGeneric);
          goPhase('intro');
          return;
        }
        if (!fix.data.assurance_token) {
          setError(ADULT_ASSURANCE_COPY.failGeneric);
          goPhase('intro');
          return;
        }
        setToken(fix.data.assurance_token);
        goPhase('liveness_ok');
        await new Promise((r) => setTimeout(r, 1200));
        if (fixture === 'adult_with_id' || fix.data.id_verified) {
          goPhase('id_ok');
          await new Promise((r) => setTimeout(r, 2200));
          onComplete({ token: fix.data.assurance_token, idVerified: true });
          return;
        }
        goPhase('upsell');
        return;
      }

      // Live path: Veriff-hosted capture only (no custom camera).
      await runVeriffFrame(started.sessionUrl, started.sessionId);
      const polled = await pollLiveness(started.sessionId, cancelRef.current);
      if ('underage' in polled) {
        onComplete({ underage: true });
        return;
      }
      if ('error' in polled) {
        setError(polled.error);
        goPhase('intro');
        return;
      }
      setToken(polled.token);
      goPhase('liveness_ok');
      await new Promise((r) => setTimeout(r, 1200));
      goPhase('upsell');
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : ADULT_ASSURANCE_COPY.failGeneric;
      setError(msg);
      goPhase('intro');
    }
  };

  const startOptionalId = async () => {
    if (!livenessSessionId || !token) {
      finish(false);
      return;
    }
    setError('');
    goPhase('id');
    cancelRef.current.cancelled = false;
    try {
      const { data: idSession } = await authAPI.startAdultAssuranceId(livenessSessionId);
      await runVeriffFrame(idSession.sessionUrl, idSession.sessionId);
      const result = await pollId(livenessSessionId, cancelRef.current);
      if (result.idVerified) {
        goPhase('id_ok');
        await new Promise((r) => setTimeout(r, 2200));
        finish(true);
        return;
      }
      setError(result.error || ADULT_ASSURANCE_COPY.idFail);
      goPhase('upsell');
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : ADULT_ASSURANCE_COPY.idFail;
      setError(msg);
      goPhase('upsell');
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
          <div className="flex flex-col gap-2" data-testid="adult-assurance-how">
            <p className="m-0 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#E0A14A]">
              {ADULT_ASSURANCE_COPY.introHowTitle}
            </p>
            <ul className="m-0 list-disc space-y-1.5 pl-5 text-[15px] leading-[1.55] text-[#A89070]">
              <li>{ADULT_ASSURANCE_COPY.introBullet1}</li>
              <li>{ADULT_ASSURANCE_COPY.introBullet2}</li>
            </ul>
            <p className={`${publicMutedCopyClass} m-0`} data-testid="adult-assurance-no-id-copies">
              {ADULT_ASSURANCE_COPY.introNoIdCopies}
            </p>
            <p className={`${publicMutedCopyClass} m-0`} data-testid="adult-assurance-age-note">
              {ADULT_ASSURANCE_COPY.introAgeNote}
            </p>
          </div>
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
          <p className="m-0 text-center text-[17px] font-bold text-[#C4832A]">
            {ADULT_ASSURANCE_COPY.livenessSuccess}
          </p>
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
          <p className={`${publicMutedCopyClass} m-0 text-center`}>{ADULT_ASSURANCE_COPY.idSuccessNote}</p>
        </div>
      ) : null}
    </div>
  );
}

export default AdultAssuranceFlow;
