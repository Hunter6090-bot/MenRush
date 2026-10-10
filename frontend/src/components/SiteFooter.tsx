import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/home-surface.css';

type SiteFooterProps = {
  className?: string;
};

/**
 * Public-site footer: Contact, Privacy, Cookies, Terms. 15px links with 44px tap targets.
 * Always the dark surface (mr-dark-surface pins dark tokens), so links stay >= 4.5:1 in
 * light and dark themes on every public page.
 */
export const SiteFooter: React.FC<SiteFooterProps> = ({ className = '' }) => {
  return (
    <footer
      className={`mr-dark-surface max-w-full overflow-x-clip border-t border-[var(--nn-border)] py-5 px-4 sm:py-6 ${className}`.trim()}
      role="contentinfo"
    >
      <nav
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-[28px] gap-y-1 text-[15px] font-semibold uppercase tracking-[0.14em] text-[var(--cream-muted)]"
        aria-label="Site links"
      >
        <Link to="/contact" className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--nn-accent-text)]">
          Contact
        </Link>
        <span className="hidden text-[var(--nn-border)] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/safety" className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--nn-accent-text)]">
          Safety
        </Link>
        <span className="hidden text-[var(--nn-border)] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/guidelines" className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--nn-accent-text)]">
          Guidelines
        </Link>
        <span className="hidden text-[var(--nn-border)] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/help" className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--nn-accent-text)]">
          Help
        </Link>
        <span className="hidden text-[var(--nn-border)] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/get-the-app" className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--nn-accent-text)]">
          Get the app
        </Link>
        <span className="hidden text-[var(--nn-border)] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/privacy" className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--nn-accent-text)]">
          Privacy
        </Link>
        <span className="hidden text-[var(--nn-border)] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/cookies" className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--nn-accent-text)]">
          Cookie Policy
        </Link>
        <span className="hidden text-[var(--nn-border)] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/terms" className="inline-flex min-h-[44px] items-center transition-colors hover:text-[var(--nn-accent-text)]">
          Terms &amp; Conditions
        </Link>
      </nav>
    </footer>
  );
};
