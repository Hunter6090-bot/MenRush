import React from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';

const sections = [
  {
    title: 'What we use',
    body:
      'MenRush uses a small set of cookies and local storage to keep you signed in, remember preferences, and understand whether the public site is working properly.',
  },
  {
    title: 'Essential cookies',
    body:
      'These support login sessions, security protections, and the waitlist or contact flows. The product cannot work properly without them.',
  },
  {
    title: 'Performance and analytics',
    body:
      'We may use lightweight analytics to understand page performance, conversion, and reliability so we can improve the launch experience without collecting more than we need.',
  },
  {
    title: 'Your choices',
    body:
      'You can clear browser storage at any time. If you disable essential cookies, parts of MenRush may stop working as intended.',
  },
];

export const Cookies = () => (
  <div className="flex min-h-dvh flex-col bg-[#0a0805] font-sans text-[#a89070]">
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-block text-xs uppercase tracking-[0.18em] text-[#a89070] transition-colors hover:text-[#c8861c]"
        >
          ← Back
        </Link>

        <article className="mt-6 rounded-2xl border border-[#2e2418]/70 bg-[#1a1410] p-6 shadow-xl sm:p-10">
          <span className="inline-block rounded-full border border-[#c8861c]/30 bg-[#c8861c]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8861c]">
            Last updated: 19 May 2026
          </span>
          <h1 className="mr-page-heading mt-4">
            Cookies
          </h1>
          <p className="mr-copy mt-3">
            This short policy explains how MenRush uses cookies and similar browser storage on the public site and app.
          </p>

          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="border-b border-[#2e2418] pb-3 text-[1.05rem] font-semibold uppercase tracking-[0.12em] text-[#c8861c]">
                  {section.title}
                </h2>
                <p className="mt-4 text-[15px] leading-[1.8] text-[#a89070]">{section.body}</p>
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>

    <SiteFooter />
  </div>
);
