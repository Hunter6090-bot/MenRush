import React from 'react';
import { Link } from 'react-router-dom';

// TODO: Replace with Termly published policy URL once live

export const Privacy = () => {
  return (
    <div className="min-h-dvh bg-[#0D0A06] text-[#F0E0C0] p-6">
      <div className="max-w-2xl mx-auto py-10">
        <Link to="/" className="text-[#A89070] text-xs hover:text-[#C4832A] transition-colors">
          ← Back
        </Link>

        <h1 className="text-3xl font-bold text-[#C4832A] mt-6 mb-2">Privacy Policy</h1>
        <p className="text-[#A89070] text-xs uppercase tracking-[0.2em] mb-8">Interim notice · pre-launch</p>

        <p className="text-[#F0E0C0]/80 leading-relaxed">
          MenRush is in pre-launch. Our full privacy policy is being finalised through our
          compliance partner and will be published before public launch.
        </p>

        <h2 className="text-lg font-semibold text-[#F0E0C0] mt-8 mb-3">In the meantime</h2>
        <ul className="space-y-2 text-[#F0E0C0]/80 leading-relaxed list-disc pl-5 marker:text-[#C4832A]">
          <li>We collect your email address (waitlist signup).</li>
          <li>We use Zoho Campaigns to send you updates.</li>
          <li>You can unsubscribe at any time.</li>
          <li>We don't sell or share your data.</li>
        </ul>

        <p className="text-[#A89070] text-sm mt-10">
          Questions?{' '}
          <a
            href="mailto:privacy@menrush.com"
            className="text-[#C4832A] hover:text-[#D4943B] underline-offset-2 hover:underline"
          >
            privacy@menrush.com
          </a>
        </p>
      </div>
    </div>
  );
};
