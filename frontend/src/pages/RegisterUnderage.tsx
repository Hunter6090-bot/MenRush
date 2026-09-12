/**
 * Under-18 / fail rejection after signup age check (liveness).
 * Hard-fail — no account. Age gate only — not Verified / KYC / OSA.
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
        copy="Age check failed. No account was created."
      />

      <div className={`${publicPanelClass} flex flex-col gap-5`} data-testid="register-underage">
        <p className="m-0 text-[15px] leading-[1.6] text-[var(--cream-muted)]">
          This room is for adult men nearby. If the selfie age check shows you are under 18,
          signup stops here. We do not keep an account or profile for you.
        </p>
        <p className="m-0 text-[15px] leading-[1.6] text-[var(--cream-muted)]">
          This is the 18+ age gate only. It is not a Verified tick and not a government ID check
          at signup. Do not retry with someone else&apos;s selfie or ID.
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
