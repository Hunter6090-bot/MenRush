import React from 'react';
import { Link } from 'react-router-dom';

type SiteFooterProps = {
  className?: string;
};

/**
 * Public-site footer: Contact, Privacy, Cookies, Terms — MenRush brand colours.
 */
export const SiteFooter: React.FC<SiteFooterProps> = ({ className = '' }) => {
  return (
    <footer
      className={`border-t border-[#3D2B0E]/35 bg-[#0a0805] py-5 px-4 sm:py-6 ${className}`.trim()}
      role="contentinfo"
    >
      <nav
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-[34px] gap-y-[18px] text-[13px] font-semibold uppercase tracking-[0.18em] text-[#A89070]"
        aria-label="Site links"
      >
        <Link to="/contact" className="transition-colors hover:text-[#c8861c]">
          Contact
        </Link>
        <span className="hidden text-[#3D2B0E] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/safety" className="transition-colors hover:text-[#c8861c]">
          Safety
        </Link>
        <span className="hidden text-[#3D2B0E] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/guidelines" className="transition-colors hover:text-[#c8861c]">
          Guidelines
        </Link>
        <span className="hidden text-[#3D2B0E] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/help" className="transition-colors hover:text-[#c8861c]">
          Help
        </Link>
        <span className="hidden text-[#3D2B0E] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/privacy" className="transition-colors hover:text-[#c8861c]">
          Privacy
        </Link>
        <span className="hidden text-[#3D2B0E] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/cookies" className="transition-colors hover:text-[#c8861c]">
          Cookie Policy
        </Link>
        <span className="hidden text-[#3D2B0E] sm:inline" aria-hidden>
          ·
        </span>
        <Link to="/terms" className="transition-colors hover:text-[#c8861c]">
          Terms &amp; Conditions
        </Link>
      </nav>
    </footer>
  );
};
