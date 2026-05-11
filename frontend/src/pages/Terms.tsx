import React from 'react';
import { Link } from 'react-router-dom';

// TODO: Replace with Termly published policy URL once live

export const Terms = () => {
  return (
    <div className="min-h-dvh bg-[#0D0A06] text-[#F0E0C0] p-6">
      <div className="max-w-2xl mx-auto py-10">
        <Link to="/" className="text-[#A89070] text-xs hover:text-[#C4832A] transition-colors">
          ← Back
        </Link>

        <h1 className="text-3xl font-bold text-[#C4832A] mt-6 mb-2">Terms of Service</h1>
        <p className="text-[#A89070] text-xs uppercase tracking-[0.2em] mb-8">Interim notice · pre-launch</p>

        <p className="text-[#F0E0C0]/80 leading-relaxed">
          MenRush is in pre-launch. Our full terms of service are being finalised and will be
          published before public launch.
        </p>

        <h2 className="text-lg font-semibold text-[#F0E0C0] mt-8 mb-3">By using this site</h2>
        <ul className="space-y-2 text-[#F0E0C0]/80 leading-relaxed list-disc pl-5 marker:text-[#C4832A]">
          <li>You confirm you are 18 or older.</li>
          <li>You agree to receive launch updates via email.</li>
          <li>You can withdraw at any time by unsubscribing.</li>
        </ul>

        <p className="text-[#A89070] text-sm mt-10">
          Questions?{' '}
          <a
            href="mailto:hello@menrush.com"
            className="text-[#C4832A] hover:text-[#D4943B] underline-offset-2 hover:underline"
          >
            hello@menrush.com
          </a>
        </p>
      </div>
    </div>
  );
};
