import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';

type Section = {
  id: string;
  number: string;
  title: string;
};

const SECTIONS: Section[] = [
  { id: 'eligibility', number: '1', title: 'Eligibility' },
  { id: 'account-registration', number: '2', title: 'Account Registration' },
  { id: 'identity-verification', number: '3', title: 'Identity Verification' },
  { id: 'acceptable-use', number: '4', title: 'Acceptable Use' },
  { id: 'user-content', number: '5', title: 'User Content' },
  { id: 'location-services', number: '6', title: 'Location Services' },
  { id: 'premium-subscription', number: '7', title: 'Premium Subscription' },
  { id: 'refunds', number: '8', title: 'Refunds' },
  { id: 'intellectual-property', number: '9', title: 'Intellectual Property' },
  { id: 'privacy', number: '10', title: 'Privacy' },
  { id: 'disclaimers', number: '11', title: 'Disclaimers' },
  { id: 'limitation-of-liability', number: '12', title: 'Limitation of Liability' },
  { id: 'termination', number: '13', title: 'Termination' },
  { id: 'changes-to-these-terms', number: '14', title: 'Changes to These Terms' },
  { id: 'governing-law', number: '15', title: 'Governing Law and Disputes' },
  { id: 'contact', number: '16', title: 'Contact' },
];

const sectionHeading = (s: Section) => (
  <h2
    id={s.id}
    className="mt-12 scroll-mt-24 border-b border-[#2e2418] pb-3 text-[1.2rem] font-semibold uppercase tracking-[0.12em] text-[#c8861c]"
  >
    <span className="mr-3 text-[#c8861c]/85">{s.number}.</span>
    {s.title}
  </h2>
);

const subHeading = (text: string) => (
  <h3 className="mt-6 text-base font-semibold text-[#f0e4cc]">{text}</h3>
);

const para = (children: React.ReactNode, key?: React.Key) => (
  <p key={key} className="mt-4 leading-[1.8] text-[15px] text-[#a89070]">
    {children}
  </p>
);

const list = (items: React.ReactNode[]) => (
  <ul className="mt-4 list-disc space-y-2 pl-5 leading-[1.8] text-[15px] text-[#a89070] marker:text-[#c8861c]">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

const Strong = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-[#f0e4cc]">{children}</strong>
);

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    className="text-[#c8861c] underline-offset-2 transition-colors hover:text-[#d9a038] hover:underline"
  >
    {children}
  </a>
);

export const Terms = () => {
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
            className="mt-6 rounded-2xl border border-[#2e2418]/70 bg-[#1a1410] p-6 shadow-xl sm:p-10"
          >
            <header>
              <span className="inline-block rounded-full border border-[#c8861c]/30 bg-[#c8861c]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8861c]">
                Last updated: 06 May 2026
              </span>
              <h1 className="mt-4 text-[2.5rem] font-bold leading-tight tracking-tight text-[#f0e4cc] sm:text-[2.75rem]">
                Terms and Conditions
              </h1>
              <p className="mt-2 text-sm text-[#a89070]">
                Effective: <Strong>June 2026</Strong> — at public launch.
              </p>
            </header>

            {/* Adult-content warning */}
            <aside
              role="note"
              className="mt-8 rounded-r border-l-[3px] border-[#c8861c] bg-[#1e1208] p-4 text-[15px] leading-[1.7] text-[#f0e4cc]/90"
            >
              <Strong>Adult platform.</Strong> MenRush is an adult platform for men aged 18 and over.
              By using this Platform you confirm you are 18 or older.
            </aside>

            {/* Table of contents */}
            <nav
              aria-label="Table of contents"
              className="mt-8 rounded-xl border border-[#2e2418] bg-[#0a0805]/60 p-5 sm:p-6"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8861c]">
                Contents
              </p>
              <ol className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {SECTIONS.map((s) => (
                  <li key={s.id} className="text-[14px] leading-[1.7]">
                    <a
                      href={`#${s.id}`}
                      className="group flex gap-2 text-[#a89070] transition-colors hover:text-[#f0e4cc]"
                    >
                      <span className="w-6 shrink-0 text-right font-semibold text-[#c8861c]">
                        {s.number}.
                      </span>
                      <span className="group-hover:underline">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Agreement preamble */}
            <section className="mt-12">
              <h2 className="border-b border-[#2e2418] pb-3 text-[1.2rem] font-semibold uppercase tracking-[0.12em] text-[#c8861c]">
                Agreement to Terms
              </h2>
              {para(
                <>
                  These Terms and Conditions ("<Strong>Terms</Strong>") form a legally binding
                  agreement between you and <Strong>Bronze Apps UK Limited</Strong> (doing
                  business as MenRush), a company registered in England and Wales ("
                  <Strong>MenRush</Strong>", "<Strong>we</Strong>", "<Strong>us</Strong>", "
                  <Strong>our</Strong>").
                </>,
              )}
              {para(
                <>
                  By accessing or using the MenRush platform — including our website at{' '}
                  <A href="https://menrush.com">menrush.com</A> and any associated mobile
                  application (collectively, the "<Strong>Platform</Strong>") — you confirm that
                  you have read, understood, and agree to be bound by these Terms. If you do not
                  agree, do not use the Platform.
                </>,
              )}
            </section>

            {/* 1. Eligibility */}
            <section>
              {sectionHeading(SECTIONS[0])}
              {para(
                <>
                  <Strong>1.1</Strong> You must be at least 18 years of age to use MenRush. By
                  creating an account, you represent and warrant that you are 18 or older.
                </>,
              )}
              {para(
                <>
                  <Strong>1.2</Strong> MenRush is a platform intended for adult men. By
                  registering, you confirm that you are male and that you are accessing the
                  Platform for lawful purposes.
                </>,
              )}
              {para(
                <>
                  <Strong>1.3</Strong> You must not use the Platform if you are located in a
                  jurisdiction where access to adult content or location-based social networking
                  is prohibited.
                </>,
              )}
              {para(
                <>
                  <Strong>1.4</Strong> We reserve the right to request age verification at any
                  time and to suspend or terminate your account if we have reason to believe you
                  do not meet the eligibility requirements.
                </>,
              )}
            </section>

            {/* 2. Account Registration */}
            <section>
              {sectionHeading(SECTIONS[1])}
              {para(
                <>
                  <Strong>2.1</Strong> To access the full features of MenRush, you must create an
                  account. You agree to:
                </>,
              )}
              {list([
                'Provide accurate, current, and complete information.',
                'Keep your login credentials secure and confidential.',
                <>
                  Notify us immediately of any unauthorised access to your account at{' '}
                  <A href="mailto:privacy@menrush.com">privacy@menrush.com</A>.
                </>,
                'Accept responsibility for all activity under your account.',
              ])}
              {para(
                <>
                  <Strong>2.2</Strong> You may not create an account on behalf of another person
                  or use another person's identity.
                </>,
              )}
              {para(
                <>
                  <Strong>2.3</Strong> MenRush accounts are personal and non-transferable.
                </>,
              )}
            </section>

            {/* 3. Identity Verification */}
            <section>
              {sectionHeading(SECTIONS[2])}
              {para(
                <>
                  <Strong>3.1</Strong> MenRush may require identity and age verification before
                  users can access discovery, matches, rooms or chat. Verification helps reduce
                  fake profiles, underage access and platform abuse.
                </>,
              )}
              {para(
                <>
                  <Strong>3.2</Strong> Verified status does not constitute an endorsement or
                  guarantee of a user's behaviour, safety, or character. MenRush accepts no
                  liability for the actions of any verified or unverified user.
                </>,
              )}
              {para(
                <>
                  <Strong>3.3</Strong> We use third-party verification services to process ID
                  documents. Your document data is handled in accordance with our{' '}
                  <Link to="/privacy" className="text-[#c8861c] hover:text-[#d9a038] hover:underline">
                    Privacy Policy
                  </Link>{' '}
                  and the provider's own terms.
                </>,
              )}
            </section>

            {/* 4. Acceptable Use */}
            <section>
              {sectionHeading(SECTIONS[3])}
              {para(
                <>
                  <Strong>4.1</Strong> You agree to use MenRush only for lawful purposes and in a
                  manner that respects other users.
                </>,
              )}
              {para(
                <>
                  <Strong>4.2</Strong> You must not:
                </>,
              )}
              {list([
                'Harass, threaten, stalk, or abuse any other user.',
                'Post false, misleading, or fraudulent information.',
                'Impersonate any person or entity.',
                'Use the Platform for commercial solicitation or spam.',
                'Distribute malware, viruses, or harmful code.',
                'Attempt to gain unauthorised access to our systems.',
                'Scrape, copy, or harvest user data.',
                'Use the Platform to facilitate prostitution, trafficking, or any form of exploitation.',
                'Engage in any activity that violates applicable law.',
              ])}
              <aside
                role="note"
                className="mt-6 rounded-r border-l-[3px] border-[#c8861c] bg-[#1e1208] p-4 text-[15px] leading-[1.7] text-[#f0e4cc]/90"
              >
                <Strong>4.3</Strong> MenRush is a platform for consensual adult connection. Any
                non-consensual behaviour — including sharing images of others without consent —
                will result in immediate account termination and may be reported to law
                enforcement.
              </aside>
            </section>

            {/* 5. User Content */}
            <section>
              {sectionHeading(SECTIONS[4])}
              {para(
                <>
                  <Strong>5.1</Strong> You are solely responsible for any content you post on
                  MenRush, including profile photos, messages, media, and any information you
                  share.
                </>,
              )}
              {para(
                <>
                  <Strong>5.2</Strong> By posting content, you grant MenRush a non-exclusive,
                  worldwide, royalty-free licence to use, display, and distribute your content
                  solely for the purpose of operating the Platform.
                </>,
              )}
              {para(
                <>
                  <Strong>5.3</Strong> You must not post content that:
                </>,
              )}
              {list([
                'Depicts minors in any sexual or suggestive context.',
                'Depicts non-consensual sexual activity.',
                'Contains hate speech targeting any protected characteristic.',
                'Violates the intellectual property rights of others.',
                'Is designed to deceive or defraud other users.',
              ])}
              {para(
                <>
                  <Strong>5.4</Strong> We reserve the right to remove any content that violates
                  these Terms or that we deem inappropriate, without notice.
                </>,
              )}
            </section>

            {/* 6. Location Services */}
            <section>
              {sectionHeading(SECTIONS[5])}
              {para(
                <>
                  <Strong>6.1</Strong> MenRush is a real-time, location-based platform. Core
                  features require access to your precise location.
                </>,
              )}
              {para(
                <>
                  <Strong>6.2</Strong> By enabling location services, you consent to your
                  approximate location being visible to other users within the Platform.
                </>,
              )}
              {para(
                <>
                  <Strong>6.3</Strong> Your exact GPS coordinates are never shared with other
                  users. Only proximity (e.g. "500m away") is displayed.
                </>,
              )}
              {para(
                <>
                  <Strong>6.4</Strong> You can disable location services at any time through your
                  device settings, though this will limit core Platform functionality.
                </>,
              )}
              {para(
                <>
                  <Strong>6.5</Strong> Location data is retained for up to 6 months in accordance
                  with our{' '}
                  <Link to="/privacy" className="text-[#c8861c] hover:text-[#d9a038] hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </>,
              )}
            </section>

            {/* 7. Premium Subscription */}
            <section>
              {sectionHeading(SECTIONS[6])}
              {para(
                <>
                  <Strong>7.1</Strong> MenRush offers a free tier and a paid Premium subscription.
                  Premium features are detailed on the Platform and are subject to change.
                </>,
              )}
              {para(
                <>
                  <Strong>7.2</Strong> Waitlist members who joined before our public launch are
                  entitled to <Strong>30 days of Premium free</Strong>, as stated at the time of
                  sign-up.
                </>,
              )}
              {para(
                <>
                  <Strong>7.3</Strong> After any free trial period, Premium subscriptions are
                  billed on a recurring basis (monthly or annually) through our payment processor,
                  Stripe.
                </>,
              )}
              {para(
                <>
                  <Strong>7.4</Strong> You authorise us to charge the payment method on file at
                  the start of each billing period.
                </>,
              )}
              {para(
                <>
                  <Strong>7.5</Strong> Prices are displayed in GBP and are inclusive of any
                  applicable VAT. We reserve the right to change pricing with 30 days' notice.
                </>,
              )}
              {para(
                <>
                  <Strong>7.6</Strong> Subscriptions auto-renew unless cancelled at least 24 hours
                  before the renewal date. You can cancel at any time through your account
                  settings.
                </>,
              )}
            </section>

            {/* 8. Refunds */}
            <section>
              {sectionHeading(SECTIONS[7])}
              {para(
                <>
                  <Strong>8.1</Strong> All subscription payments are non-refundable except where
                  required by applicable law.
                </>,
              )}
              {para(
                <>
                  <Strong>8.2</Strong> If you believe a charge was made in error, contact us at{' '}
                  <A href="mailto:support@menrush.com">support@menrush.com</A> within 14 days of
                  the charge.
                </>,
              )}
              {para(
                <>
                  <Strong>8.3</Strong> Under UK consumer law, you have a 14-day cooling-off period
                  for digital services. By accessing Premium features immediately after purchase,
                  you acknowledge that this right may be waived.
                </>,
              )}
            </section>

            {/* 9. Intellectual Property */}
            <section>
              {sectionHeading(SECTIONS[8])}
              {para(
                <>
                  <Strong>9.1</Strong> The MenRush name, logo, design, and all Platform content
                  (excluding user-generated content) are the intellectual property of Bronze Apps
                  UK Limited.
                </>,
              )}
              {para(
                <>
                  <Strong>9.2</Strong> You may not reproduce, distribute, or create derivative
                  works from any MenRush content without our express written permission.
                </>,
              )}
              {para(
                <>
                  <Strong>9.3</Strong> All rights not expressly granted are reserved.
                </>,
              )}
            </section>

            {/* 10. Privacy */}
            <section>
              {sectionHeading(SECTIONS[9])}
              {para(
                <>
                  Your use of MenRush is subject to our{' '}
                  <Link to="/privacy" className="text-[#c8861c] hover:text-[#d9a038] hover:underline">
                    Privacy Policy
                  </Link>
                  , which is incorporated into these Terms by reference. By using the Platform,
                  you consent to the collection and use of your information as described in the
                  Privacy Policy.
                </>,
              )}
              {para(
                <>
                  Our Privacy Policy is available at{' '}
                  <A href="https://menrush.com/privacy">menrush.com/privacy</A>.
                </>,
              )}
            </section>

            {/* 11. Disclaimers */}
            <section>
              {sectionHeading(SECTIONS[10])}
              {para(
                <>
                  <Strong>11.1</Strong> MenRush is provided "as is" and "as available" without
                  warranties of any kind, express or implied.
                </>,
              )}
              {para(
                <>
                  <Strong>11.2</Strong> We do not guarantee that the Platform will be
                  uninterrupted, error-free, or free of viruses or harmful components.
                </>,
              )}
              <aside
                role="note"
                className="mt-6 rounded-r border-l-[3px] border-[#c8861c] bg-[#1e1208] p-4 text-[15px] leading-[1.7] text-[#f0e4cc]/90"
              >
                <Strong>11.3 Stay safe.</Strong> MenRush does not conduct background checks on
                users. We strongly encourage you to exercise caution when meeting other users in
                person. Always meet in public places first and inform someone you trust of your
                plans.
              </aside>
              {para(
                <>
                  <Strong>11.4</Strong> We are not responsible for the conduct of any user on or
                  off the Platform.
                </>,
              )}
            </section>

            {/* 12. Limitation of Liability */}
            <section>
              {sectionHeading(SECTIONS[11])}
              {para(
                <>
                  <Strong>12.1</Strong> To the fullest extent permitted by law, MenRush shall not
                  be liable for any indirect, incidental, special, consequential, or punitive
                  damages arising from your use of the Platform.
                </>,
              )}
              {para(
                <>
                  <Strong>12.2</Strong> Our total liability to you for any claim arising under
                  these Terms shall not exceed the amount you paid to us in the 12 months
                  preceding the claim.
                </>,
              )}
              {para(
                <>
                  <Strong>12.3</Strong> Nothing in these Terms limits our liability for death or
                  personal injury caused by negligence, fraud, or any other liability that cannot
                  be limited by law.
                </>,
              )}
            </section>

            {/* 13. Termination */}
            <section>
              {sectionHeading(SECTIONS[12])}
              {para(
                <>
                  <Strong>13.1</Strong> You may delete your account at any time through your
                  account settings or by contacting{' '}
                  <A href="mailto:support@menrush.com">support@menrush.com</A>.
                </>,
              )}
              {para(
                <>
                  <Strong>13.2</Strong> We reserve the right to suspend or terminate your account
                  at any time, with or without notice, if we believe you have violated these
                  Terms or pose a risk to other users or to MenRush.
                </>,
              )}
              {para(
                <>
                  <Strong>13.3</Strong> Upon termination, your right to use the Platform ceases
                  immediately. We will handle your data in accordance with our{' '}
                  <Link to="/privacy" className="text-[#c8861c] hover:text-[#d9a038] hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </>,
              )}
            </section>

            {/* 14. Changes */}
            <section>
              {sectionHeading(SECTIONS[13])}
              {para(
                <>
                  <Strong>14.1</Strong> We may update these Terms from time to time. We will
                  notify you of material changes by email or through the Platform.
                </>,
              )}
              {para(
                <>
                  <Strong>14.2</Strong> Your continued use of MenRush after changes take effect
                  constitutes your acceptance of the updated Terms.
                </>,
              )}
              {para(
                <>
                  <Strong>14.3</Strong> The current version of these Terms is always available at{' '}
                  <A href="https://menrush.com/terms">menrush.com/terms</A>.
                </>,
              )}
            </section>

            {/* 15. Governing law */}
            <section>
              {sectionHeading(SECTIONS[14])}
              {para(
                <>
                  <Strong>15.1</Strong> These Terms are governed by the laws of England and Wales.
                </>,
              )}
              {para(
                <>
                  <Strong>15.2</Strong> Any dispute arising from these Terms shall be subject to
                  the exclusive jurisdiction of the courts of England and Wales, unless you are a
                  consumer resident in another jurisdiction where mandatory local law applies.
                </>,
              )}
              {para(
                <>
                  <Strong>15.3</Strong> If you are a consumer in the UK or EU, you also have the
                  right to use the EU Online Dispute Resolution platform or contact the UK's
                  Alternative Dispute Resolution services.
                </>,
              )}
            </section>

            {/* 16. Contact (card-styled) */}
            <section>
              {sectionHeading(SECTIONS[15])}
              {para(<>For questions about these Terms:</>)}
              <div className="mt-5 rounded-2xl border border-[#2e2418] bg-[#0a0805]/70 p-5 sm:p-6">
                <p className="text-[15px] font-semibold text-[#f0e4cc]">
                  Bronze Apps UK Limited <span className="font-normal text-[#a89070]">(doing business as MenRush)</span>
                </p>
                {subHeading('Data Protection Officer')}
                <address className="mt-2 not-italic leading-[1.8] text-[15px] text-[#a89070]">
                  Office 9811, 321–323 High Road
                  <br />
                  Chadwell Heath, Essex, RM6 6AX
                  <br />
                  England
                </address>

                <dl className="mt-5 grid gap-3 text-[15px] sm:grid-cols-[120px_1fr]">
                  <dt className="font-semibold uppercase tracking-[0.12em] text-[#c8861c]/90 text-xs sm:text-[11px]">
                    Support
                  </dt>
                  <dd>
                    <A href="mailto:support@menrush.com">support@menrush.com</A>
                  </dd>

                  <dt className="font-semibold uppercase tracking-[0.12em] text-[#c8861c]/90 text-xs sm:text-[11px]">
                    Privacy
                  </dt>
                  <dd>
                    <A href="mailto:privacy@menrush.com">privacy@menrush.com</A>
                  </dd>

                  <dt className="font-semibold uppercase tracking-[0.12em] text-[#c8861c]/90 text-xs sm:text-[11px]">
                    Website
                  </dt>
                  <dd>
                    <Link
                      to="/contact"
                      className="text-[#c8861c] hover:text-[#d9a038] hover:underline"
                    >
                      menrush.com/contact
                    </Link>
                  </dd>

                  <dt className="font-semibold uppercase tracking-[0.12em] text-[#c8861c]/90 text-xs sm:text-[11px]">
                    Phone
                  </dt>
                  <dd>
                    <A href="tel:+447988586674">+44 7988 586 674</A>
                  </dd>
                </dl>
              </div>
            </section>

            <p className="mt-12 text-center text-[11px] uppercase tracking-[0.3em] text-[#a89070]/70">
              — End of Terms —
            </p>
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
