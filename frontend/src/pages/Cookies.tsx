import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';

type CookieRow = {
  type: string;
  name: string;
  purpose: string;
  duration: string;
  party: string;
};

const COOKIE_ROWS: CookieRow[] = [
  {
    type: 'Essential',
    name: 'session_id',
    purpose: 'Maintains your login session and keeps you authenticated',
    duration: 'Session',
    party: 'First-party',
  },
  {
    type: 'Essential',
    name: 'csrf_token',
    purpose: 'Protects against cross-site request forgery attacks',
    duration: 'Session',
    party: 'First-party',
  },
  {
    type: 'Functional',
    name: 'user_prefs',
    purpose: 'Stores your display preferences and settings',
    duration: '1 year',
    party: 'First-party',
  },
  {
    type: 'Analytics',
    name: '_ga',
    purpose: 'Google Analytics — distinguishes unique users',
    duration: '2 years',
    party: 'Third-party (Google)',
  },
  {
    type: 'Analytics',
    name: '_ga_*',
    purpose: 'Google Analytics — maintains session state',
    duration: '1 year',
    party: 'Third-party (Google)',
  },
  {
    type: 'Performance',
    name: 'vercel_analytics',
    purpose: 'Tracks page performance and load times',
    duration: 'Session',
    party: 'Third-party (Vercel)',
  },
];

const BROWSER_LINKS: Array<{ name: string; href: string }> = [
  { name: 'Chrome', href: 'https://support.google.com/chrome/answer/95647' },
  {
    name: 'Firefox',
    href: 'https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop',
  },
  { name: 'Safari', href: 'https://support.apple.com/en-ie/guide/safari/sfri11471/mac' },
  {
    name: 'Edge',
    href: 'https://support.microsoft.com/en-us/windows/microsoft-edge-browsing-data-and-privacy-bb8174ba-9d73-dcf2-9b4a-c582b4e640dd',
  },
  { name: 'Opera', href: 'https://help.opera.com/en/latest/web-preferences/' },
];

const AD_OPTOUT_LINKS: Array<{ name: string; href: string }> = [
  { name: 'Digital Advertising Alliance', href: 'http://www.aboutads.info/choices/' },
  { name: 'Digital Advertising Alliance of Canada', href: 'https://youradchoices.ca/' },
  {
    name: 'European Interactive Digital Advertising Alliance',
    href: 'http://www.youronlinechoices.com/',
  },
];

const SECTIONS = [
  { id: 'what-are-cookies', title: 'What are cookies?' },
  { id: 'why-we-use-cookies', title: 'Why do we use cookies?' },
  { id: 'how-to-control', title: 'How can I control cookies?' },
  { id: 'cookies-table', title: 'Cookies we use' },
  { id: 'browser-controls', title: 'How can I control cookies on my browser?' },
  { id: 'tracking-tech', title: 'What about other tracking technologies, like web beacons?' },
  { id: 'targeted-ads', title: 'Do you serve targeted advertising?' },
  { id: 'updates', title: 'How often will you update this Cookie Policy?' },
  { id: 'contact', title: 'Where can I get further information?' },
] as const;

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    target={href.startsWith('http') ? '_blank' : undefined}
    rel={href.startsWith('http') ? 'noreferrer' : undefined}
    className="text-[#c8861c] underline-offset-2 transition-colors hover:text-[#d9a038] hover:underline"
  >
    {children}
  </a>
);

const Strong = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-[#f0e4cc]">{children}</strong>
);

const sectionHeading = (id: string, text: string) => (
  <h2
    id={id}
    className="mt-12 scroll-mt-24 border-b border-[#2e2418] pb-[6px] text-[1.1rem] font-semibold uppercase tracking-[0.12em] text-[#c8861c]"
  >
    {text}
  </h2>
);

const subHeading = (text: string) => (
  <h3 className="mt-6 text-base font-semibold text-[#f0e4cc]">{text}</h3>
);

const para = (children: React.ReactNode, key?: React.Key) => (
  <p key={key} className="mt-4 text-[15px] leading-[1.85] text-[#a89070]">
    {children}
  </p>
);

export const Cookies = () => {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0805] font-sans text-[#a89070]">
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-[860px]">
          <Link
            to="/"
            className="inline-block text-xs uppercase tracking-[0.18em] text-[#a89070] transition-colors hover:text-[#c8861c]"
          >
            ← Back
          </Link>

          <article
            id="top"
            className="mt-6 rounded-2xl border border-[#2e2418]/70 bg-[#1a1410] p-12 shadow-xl"
          >
            <header>
              <h1 className="text-[2.5rem] font-bold leading-tight tracking-tight text-[#f0e4cc] sm:text-[2.75rem]">
                Cookie Policy
              </h1>
              <p className="mt-2 text-sm italic text-[#888]">Last updated 11 May 2026</p>
            </header>

            {/* Preamble */}
            <section className="mt-8">
              {para(
                <>
                  This Cookie Policy explains how <Strong>Bronze Apps UK Limited</Strong> ("
                  <Strong>Company</Strong>," "<Strong>we</Strong>," "<Strong>us</Strong>," and "
                  <Strong>our</Strong>") uses cookies and similar technologies to recognize you
                  when you visit our website at <A href="https://menrush.com">https://menrush.com</A>{' '}
                  ("<Strong>Website</Strong>"). It explains what these technologies are and why we
                  use them, as well as your rights to control our use of them.
                </>,
              )}
              {para(
                <>
                  In some cases we may use cookies to collect personal information, or that becomes
                  personal information if we combine it with other information.
                </>,
              )}
            </section>

            {/* What are cookies */}
            <section>
              {sectionHeading(SECTIONS[0].id, SECTIONS[0].title)}
              {para(
                <>
                  Cookies are small data files that are placed on your computer or mobile device
                  when you visit a website. Cookies are widely used by website owners in order to
                  make their websites work, or to work more efficiently, as well as to provide
                  reporting information.
                </>,
              )}
              {para(
                <>
                  Cookies set by the website owner (in this case, Bronze Apps UK Limited) are
                  called "<Strong>first-party cookies</Strong>." Cookies set by parties other than
                  the website owner are called "<Strong>third-party cookies</Strong>." Third-party
                  cookies enable third-party features or functionality to be provided on or through
                  the website (e.g., advertising, interactive content, and analytics). The parties
                  that set these third-party cookies can recognize your computer both when it
                  visits the website in question and also when it visits certain other websites.
                </>,
              )}
            </section>

            {/* Why */}
            <section>
              {sectionHeading(SECTIONS[1].id, SECTIONS[1].title)}
              {para(
                <>
                  We use first- and third-party cookies for several reasons. Some cookies are
                  required for technical reasons in order for our Website to operate, and we refer
                  to these as "<Strong>essential</Strong>" or "
                  <Strong>strictly necessary</Strong>" cookies. Other cookies also enable us to
                  track and target the interests of our users to enhance the experience on our
                  Online Properties. Third parties serve cookies through our Website for
                  advertising, analytics, and other purposes. This is described in more detail
                  below.
                </>,
              )}
            </section>

            {/* How to control */}
            <section>
              {sectionHeading(SECTIONS[2].id, SECTIONS[2].title)}
              {para(
                <>
                  You have the right to decide whether to accept or reject cookies. You can
                  exercise your cookie rights by setting your preferences in the{' '}
                  <Strong>Cookie Preference Center</Strong>. The Cookie Preference Center allows
                  you to select which categories of cookies you accept or reject. Essential cookies
                  cannot be rejected as they are strictly necessary to provide you with services.
                </>,
              )}
              {para(
                <>
                  The Cookie Preference Center can be found in the notification banner and on our
                  Website. If you choose to reject cookies, you may still use our Website though
                  your access to some functionality and areas of our Website may be restricted. You
                  may also set or amend your web browser controls to accept or refuse cookies.
                </>,
              )}
              {para(
                <>
                  The specific types of first- and third-party cookies served through our Website
                  and the purposes they perform are described in the table below:
                </>,
              )}

              {/* Cookie table */}
              <div className="mt-6 -mx-2 overflow-x-auto sm:mx-0">
                <table
                  id={SECTIONS[3].id}
                  className="scroll-mt-24 w-full min-w-[640px] border-collapse border border-[#2e2418] text-left text-[14px]"
                >
                  <thead>
                    <tr className="bg-[#0f0b07]">
                      {['Type', 'Cookie Name', 'Purpose', 'Duration', 'Party'].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="border border-[#2e2418] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c8861c]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COOKIE_ROWS.map((row, idx) => (
                      <tr
                        key={`${row.name}-${idx}`}
                        className={idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0f0b07]/55'}
                      >
                        <td className="border border-[#2e2418] px-4 py-3 align-top text-[#a89070]">
                          {row.type}
                        </td>
                        <td className="border border-[#2e2418] px-4 py-3 align-top font-mono text-[13px] text-[#a89070]">
                          {row.name}
                        </td>
                        <td className="border border-[#2e2418] px-4 py-3 align-top leading-[1.6] text-[#a89070]">
                          {row.purpose}
                        </td>
                        <td className="border border-[#2e2418] px-4 py-3 align-top whitespace-nowrap text-[#a89070]">
                          {row.duration}
                        </td>
                        <td className="border border-[#2e2418] px-4 py-3 align-top text-[#a89070]">
                          {row.party}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Browser controls */}
            <section>
              {sectionHeading(SECTIONS[4].id, SECTIONS[4].title)}
              {para(
                <>
                  As the means by which you can refuse cookies through your web browser controls
                  vary from browser to browser, you should visit your browser's help menu for more
                  information. The following is information about how to manage cookies on the
                  most popular browsers:
                </>,
              )}
              <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-[1.85] text-[#a89070] marker:text-[#c8861c]">
                {BROWSER_LINKS.map((b) => (
                  <li key={b.name}>
                    <Strong>{b.name}:</Strong> <A href={b.href}>{b.href}</A>
                  </li>
                ))}
              </ul>

              {para(
                <>
                  In addition, most advertising networks offer you a way to opt out of targeted
                  advertising. If you would like to find out more information, please visit:
                </>,
              )}
              <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-[1.85] text-[#a89070] marker:text-[#c8861c]">
                {AD_OPTOUT_LINKS.map((b) => (
                  <li key={b.name}>
                    <Strong>{b.name}:</Strong> <A href={b.href}>{b.href}</A>
                  </li>
                ))}
              </ul>
            </section>

            {/* Tracking tech */}
            <section>
              {sectionHeading(SECTIONS[5].id, SECTIONS[5].title)}
              {para(
                <>
                  Cookies are not the only way to recognize or track visitors to a website. We may
                  use other, similar technologies from time to time, like web beacons (sometimes
                  called "tracking pixels" or "clear gifs"). These are tiny graphics files that
                  contain a unique identifier that enables us to recognize when someone has visited
                  our Website or opened an email including them. This allows us, for example, to
                  monitor the traffic patterns of users from one page within a website to another,
                  to deliver or communicate with cookies, to understand whether you have come to
                  the website from an online advertisement displayed on a third-party website, to
                  improve site performance, and to measure the success of email marketing
                  campaigns. In many instances, these technologies are reliant on cookies to
                  function properly, and so declining cookies will impair their functioning.
                </>,
              )}
            </section>

            {/* Targeted ads */}
            <section>
              {sectionHeading(SECTIONS[6].id, SECTIONS[6].title)}
              {para(
                <>
                  Third parties may serve cookies on your computer or mobile device to serve
                  advertising through our Website. These companies may use information about your
                  visits to this and other websites in order to provide relevant advertisements
                  about goods and services that you may be interested in. They may also employ
                  technology that is used to measure the effectiveness of advertisements. The
                  information collected through this process does not enable us or them to identify
                  your name, contact details, or other details that directly identify you unless
                  you choose to provide these.
                </>,
              )}
            </section>

            {/* Updates */}
            <section>
              {sectionHeading(SECTIONS[7].id, SECTIONS[7].title)}
              {para(
                <>
                  We may update this Cookie Policy from time to time in order to reflect, for
                  example, changes to the cookies we use or for other operational, legal, or
                  regulatory reasons. Please therefore revisit this Cookie Policy regularly to stay
                  informed about our use of cookies and related technologies.
                </>,
              )}
              {para(<>The date at the top of this Cookie Policy indicates when it was last updated.</>)}
            </section>

            {/* Contact */}
            <section>
              {sectionHeading(SECTIONS[8].id, SECTIONS[8].title)}
              {para(
                <>
                  If you have any questions about our use of cookies or other technologies, please
                  email us at <A href="mailto:support@menrush.com">support@menrush.com</A> or by
                  post to:
                </>,
              )}

              <div className="mt-5 rounded-2xl border border-[#2e2418] border-l-[3px] border-l-[#c8861c] bg-[#0a0805]/70 p-5 sm:p-6">
                <p className="text-[15px] font-semibold text-[#f0e4cc]">
                  Bronze Apps UK Limited
                </p>
                {subHeading('Registered office')}
                <address className="mt-2 not-italic text-[15px] leading-[1.85] text-[#a89070]">
                  Office 9811, 321-323 High Road
                  <br />
                  Chadwell Heath, Essex, RM6 6AX
                  <br />
                  England
                </address>

                <dl className="mt-5 grid gap-3 text-[15px] sm:grid-cols-[120px_1fr]">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8861c]/90">
                    Support
                  </dt>
                  <dd>
                    <A href="mailto:support@menrush.com">support@menrush.com</A>
                  </dd>

                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8861c]/90">
                    Phone
                  </dt>
                  <dd>
                    <A href="tel:+447988586674">+44 7988 586674</A>
                  </dd>
                </dl>
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* Back-to-top button */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Back to top"
        className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[#c8861c] text-[#0a0805] shadow-lg transition-all hover:bg-[#d9a038] active:scale-95 ${
          showTop ? 'opacity-100 translate-y-0' : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.4}
          className="h-5 w-5"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <SiteFooter />
    </div>
  );
};
