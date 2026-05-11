import React from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';

// TODO: Replace with Termly published policy URL once live

export const Terms = () => {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0805] text-[#a89070]">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <Link to="/" className="text-xs uppercase tracking-[0.18em] text-[#a89070] transition-colors hover:text-[#c8861c]">
          ← Back
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-[#f0e4cc]">Terms of Service</h1>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#a89070]/90">Interim notice · pre-launch</p>

        <p className="mt-8 leading-relaxed text-[#f0e4cc]/85">
          MenRush is in pre-launch. Our full terms of service are being finalised and will be
          published before public launch.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-[#f0e4cc]">By using this site</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-[#f0e4cc]/85 marker:text-[#c8861c]">
          <li>You confirm you are 18 or older.</li>
          <li>You agree to receive launch updates via email.</li>
          <li>You can withdraw at any time by unsubscribing.</li>
        </ul>

        <p className="mt-10 text-sm text-[#a89070]">
          Questions?{' '}
          <a
            href="mailto:hello@menrush.com"
            className="font-medium text-[#c8861c] underline-offset-2 transition-colors hover:text-[#d9a038] hover:underline"
          >
            hello@menrush.com
          </a>
        </p>
      </div>
      <SiteFooter />
    </div>
  );
};
