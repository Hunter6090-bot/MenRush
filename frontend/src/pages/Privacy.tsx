import React from 'react';
import { Link } from 'react-router-dom';

// TODO: Replace with Termly published policy URL once live

export const Privacy = () => {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0805] text-[#a89070]">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <Link to="/" className="text-xs uppercase tracking-[0.18em] text-[#a89070] transition-colors hover:text-[#c8861c]">
          ← Back
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-[#f0e4cc]">Privacy Policy</h1>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#a89070]/90">Interim notice · pre-launch</p>

        <p className="mt-8 leading-relaxed text-[#f0e4cc]/85">
          MenRush is in pre-launch. Our full privacy policy is being finalised through our
          compliance partner and will be published before public launch.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-[#f0e4cc]">In the meantime</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-[#f0e4cc]/85 marker:text-[#c8861c]">
          <li>We collect your email address (waitlist signup).</li>
          <li>We use Zoho Campaigns to send you updates.</li>
          <li>You can unsubscribe at any time.</li>
          <li>We don&apos;t sell or share your data.</li>
        </ul>

        <p className="mt-10 text-sm text-[#a89070]">
          Questions?{' '}
          <a
            href="mailto:privacy@menrush.com"
            className="font-medium text-[#c8861c] underline-offset-2 transition-colors hover:text-[#d9a038] hover:underline"
          >
            privacy@menrush.com
          </a>
        </p>
      </div>
      <footer className="mt-auto w-full py-4 text-center text-[10px] text-[#a89070]/80">
        <Link to="/privacy" className="underline">
          Privacy
        </Link>
        {' · '}
        <Link to="/terms" className="underline">
          Terms
        </Link>
        {' · '}
        <Link to="/" className="underline">
          Home
        </Link>
      </footer>
    </div>
  );
};
