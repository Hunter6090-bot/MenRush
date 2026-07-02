import { Link } from 'react-router-dom';

type SiteFooterProps = {
  className?: string;
};

/** Public footer — only routes that exist on the production waitlist branch. */
export function SiteFooter({ className = '' }: SiteFooterProps) {
  return (
    <footer
      className={`border-t border-[#3D2B0E]/35 bg-[#0a0805] py-5 px-4 sm:py-6 ${className}`.trim()}
      role="contentinfo"
    >
      <nav
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-[0.14em] text-[#a89070] sm:text-sm sm:tracking-[0.12em]"
        aria-label="Site links"
      >
        <Link to="/privacy" className="transition-colors hover:text-[#c8861c]">
          Privacy
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
}
