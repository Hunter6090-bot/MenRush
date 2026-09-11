/**
 * Under-18 rejection after document date-of-birth fails the 18+ age gate.
 * Legal: hard-fail — no account row. Honest age-gate copy only — not ID-verified /
 * KYC / Verified badge / OSA compliance claims.
 */
import { Link } from 'react-router-dom';
import {
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import {
  publicLinkClass,
  publicPanelClass,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';

export const RegisterUnderage = () => {
  return (
    <PublicAuthShell>
      <PublicAuthHero
        title="MenRush is"
        accent="18+ only."
        copy="Your age check showed you are under 18. No account was created."
      />

      <div className={`${publicPanelClass} flex flex-col gap-5`}>
        <p className="m-0 text-[15px] leading-[1.6] text-[var(--cream-muted)]">
          This room is for adult men who want to meet nearby. Signup stops here when
          the document date of birth is under 18. We do not keep a MenRush account
          or profile for you — only the age-check session id needed for audit.
        </p>
        <p className="m-0 text-[15px] leading-[1.6] text-[var(--cream-muted)]">
          This is an 18+ age gate, not a Verified badge and not a full identity check.
          If you are under 18, leave now. Do not try again with someone else&apos;s
          document.
        </p>
        <Link to="/coming-soon" className={`${publicPrimaryButtonClass} text-center no-underline`}>
          Back to MenRush
        </Link>
        <p className="m-0 text-center text-[13px] text-[var(--cream-muted)]">
          Questions?{' '}
          <Link to="/contact" className={publicLinkClass}>
            Contact
          </Link>
        </p>
      </div>
    </PublicAuthShell>
  );
};

export default RegisterUnderage;
