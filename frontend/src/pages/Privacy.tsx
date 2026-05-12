import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';

type Section = {
  id: string;
  number: string;
  title: string;
};

const SECTIONS: Section[] = [
  { id: 'who-we-are', number: '1', title: 'Who We Are' },
  { id: 'information-we-collect', number: '2', title: 'Information We Collect' },
  { id: 'how-we-use-information', number: '3', title: 'How We Use Your Information' },
  { id: 'lawful-basis', number: '4', title: 'Lawful Basis for Processing' },
  { id: 'sharing', number: '5', title: 'Sharing Your Information' },
  { id: 'location-data', number: '6', title: 'Location Data' },
  { id: 'verification', number: '7', title: 'Identity Verification & Photos' },
  { id: 'cookies', number: '8', title: 'Cookies & Tracking' },
  { id: 'international-transfers', number: '9', title: 'International Data Transfers' },
  { id: 'retention', number: '10', title: 'Data Retention' },
  { id: 'your-rights', number: '11', title: 'Your Rights' },
  { id: 'children', number: '12', title: 'Children & Minors' },
  { id: 'security', number: '13', title: 'Security' },
  { id: 'changes', number: '14', title: 'Changes to This Policy' },
  { id: 'complaints', number: '15', title: 'Complaints' },
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

export const Privacy = () => {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

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
                Last updated: 12 May 2026
              </span>
              <h1 className="mt-4 text-[2.5rem] font-bold leading-tight tracking-tight text-[#f0e4cc] sm:text-[2.75rem]">
                Privacy Policy
              </h1>
              <p className="mt-2 text-sm text-[#a89070]">
                Effective: <Strong>June 2026</Strong> — at public launch.
              </p>
            </header>

            {/* Adult / privacy-first notice */}
            <aside
              role="note"
              className="mt-8 rounded-r border-l-[3px] border-[#c8861c] bg-[#1e1208] p-4 text-[15px] leading-[1.7] text-[#f0e4cc]/90"
            >
              <Strong>Your data, your control.</Strong> MenRush is designed
              privacy-first. Your exact GPS coordinates are never shared with other
              users — only an approximate distance. We do not sell your data.
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

            {/* Preamble */}
            <section className="mt-12">
              <h2 className="border-b border-[#2e2418] pb-3 text-[1.2rem] font-semibold uppercase tracking-[0.12em] text-[#c8861c]">
                About This Policy
              </h2>
              {para(
                <>
                  This Privacy Policy explains how{' '}
                  <Strong>Bronze Apps UK Limited</Strong> (doing business as MenRush,
                  "<Strong>MenRush</Strong>", "<Strong>we</Strong>", "
                  <Strong>us</Strong>", "<Strong>our</Strong>") collects, uses,
                  shares, and protects your personal information when you use our
                  website at <A href="https://menrush.com">menrush.com</A> and any
                  associated mobile applications (collectively, the "
                  <Strong>Platform</Strong>").
                </>,
              )}
              {para(
                <>
                  This policy is written to comply with the{' '}
                  <Strong>UK General Data Protection Regulation</Strong> (UK GDPR),
                  the <Strong>Data Protection Act 2018</Strong>, the{' '}
                  <Strong>EU General Data Protection Regulation</Strong> (GDPR), and
                  the <Strong>Privacy and Electronic Communications Regulations</Strong>{' '}
                  (PECR).
                </>,
              )}
            </section>

            {/* 1. Who We Are */}
            <section>
              {sectionHeading(SECTIONS[0])}
              {para(
                <>
                  <Strong>1.1</Strong> Bronze Apps UK Limited is the{' '}
                  <Strong>data controller</Strong> responsible for your personal
                  information.
                </>,
              )}
              <div className="mt-5 rounded-2xl border border-[#2e2418] bg-[#0a0805]/70 p-5 sm:p-6">
                <p className="text-[15px] font-semibold text-[#f0e4cc]">
                  Bronze Apps UK Limited{' '}
                  <span className="font-normal text-[#a89070]">
                    (doing business as MenRush)
                  </span>
                </p>
                <address className="mt-2 not-italic leading-[1.8] text-[15px] text-[#a89070]">
                  Office 9811, 321–323 High Road
                  <br />
                  Chadwell Heath, Essex, RM6 6AX
                  <br />
                  England, United Kingdom
                </address>
                <p className="mt-3 text-[14px] text-[#a89070]">
                  Registered in England and Wales.
                </p>
              </div>
              {para(
                <>
                  <Strong>1.2</Strong> If you have any questions about this policy or
                  how we handle your data, contact our Data Protection Officer at{' '}
                  <A href="mailto:privacy@menrush.com">privacy@menrush.com</A>.
                </>,
              )}
            </section>

            {/* 2. Information We Collect */}
            <section>
              {sectionHeading(SECTIONS[1])}
              {para(
                <>
                  <Strong>2.1</Strong> We collect information that you provide
                  directly, information generated by your use of the Platform, and
                  information from limited third-party sources.
                </>,
              )}
              {subHeading('2.2 Information you provide')}
              {list([
                <>
                  <Strong>Account data</Strong> — email address, password (stored
                  hashed), date of birth.
                </>,
                <>
                  <Strong>Profile data</Strong> — display name, age, gender, sexual
                  orientation, photos, interests, kinks, "about me" text, mood
                  status.
                </>,
                <>
                  <Strong>Communications</Strong> — messages you send to other users,
                  voice notes, photos and videos shared in chat, room messages.
                </>,
                <>
                  <Strong>Verification data</Strong> — if you choose to verify your
                  identity, a government-issued ID document and selfie (processed by
                  our verification provider, see §7).
                </>,
                <>
                  <Strong>Payment data</Strong> — if you subscribe to Premium, your
                  card details are collected directly by <Strong>Stripe</Strong>; we
                  receive only a subscription identifier, the last four digits, and
                  card brand.
                </>,
                <>
                  <Strong>Support enquiries</Strong> — anything you send to{' '}
                  <A href="mailto:support@menrush.com">support@menrush.com</A> or{' '}
                  <A href="mailto:privacy@menrush.com">privacy@menrush.com</A>.
                </>,
              ])}
              {subHeading('2.3 Information collected automatically')}
              {list([
                <>
                  <Strong>Location data</Strong> — your device's GPS coordinates,
                  used to find users nearby (see §6 for how we protect this).
                </>,
                <>
                  <Strong>Device data</Strong> — device type, operating system,
                  browser, IP address, app version, language, time zone.
                </>,
                <>
                  <Strong>Usage data</Strong> — pages viewed, features used, taps,
                  scroll behaviour, search filters, session length, crash logs.
                </>,
                <>
                  <Strong>Online status</Strong> — whether you are active on the
                  Platform, last seen time.
                </>,
                <>
                  <Strong>Cookies and similar technologies</Strong> — see our{' '}
                  <Link
                    to="/cookies"
                    className="text-[#c8861c] hover:text-[#d9a038] hover:underline"
                  >
                    Cookie Policy
                  </Link>{' '}
                  for full detail.
                </>,
              ])}
              {subHeading('2.4 Information from third parties')}
              {list([
                <>
                  <Strong>Stripe</Strong> — subscription status, billing events.
                </>,
                <>
                  <Strong>Identity verification provider</Strong> — pass/fail result
                  and verified-status flag (see §7).
                </>,
                <>
                  <Strong>Push-notification providers</Strong> — device tokens for
                  delivering notifications.
                </>,
              ])}
            </section>

            {/* 3. How We Use Information */}
            <section>
              {sectionHeading(SECTIONS[2])}
              {para(
                <>
                  <Strong>3.1</Strong> We use your information to:
                </>,
              )}
              {list([
                'Operate the Platform and provide the services you request.',
                'Show you nearby users and let other users discover you.',
                'Send messages between you and other users.',
                'Process Premium subscriptions and billing.',
                'Verify your identity (when you opt in).',
                'Send service emails (account verification, password resets, security alerts, subscription confirmations).',
                'Send marketing and product updates if you have opted in (you can unsubscribe at any time).',
                'Protect the Platform from fraud, abuse, harassment, and other harm.',
                'Comply with legal obligations and respond to lawful requests.',
                'Improve, test, and develop new features.',
              ])}
            </section>

            {/* 4. Lawful Basis */}
            <section>
              {sectionHeading(SECTIONS[3])}
              {para(
                <>
                  <Strong>4.1</Strong> Under UK and EU data-protection law we may
                  only process your personal data if we have a lawful basis. The
                  bases we rely on are:
                </>,
              )}
              {list([
                <>
                  <Strong>Contract</Strong> — to provide the Platform you signed up
                  for (e.g. showing you nearby users, delivering messages, running
                  your subscription).
                </>,
                <>
                  <Strong>Consent</Strong> — for location services, marketing
                  emails, push notifications, optional identity verification, and
                  any cookies that are not strictly necessary. You can withdraw
                  consent at any time.
                </>,
                <>
                  <Strong>Legitimate interests</Strong> — to keep the Platform
                  secure, prevent fraud and abuse, debug, and improve the product.
                  We balance our interests against your rights and freedoms.
                </>,
                <>
                  <Strong>Legal obligation</Strong> — to comply with our tax,
                  accounting, anti-fraud, and law-enforcement obligations.
                </>,
                <>
                  <Strong>Vital interests</Strong> — in rare cases, to protect
                  someone's life (e.g. a credible threat reported to us).
                </>,
              ])}
              {para(
                <>
                  <Strong>4.2 Special-category data.</Strong> Information that
                  relates to your sexual life or sexual orientation is "special
                  category" data under UK GDPR. By creating a MenRush profile
                  (which is inherently used for finding sexual or romantic
                  connections with other men), you provide your{' '}
                  <Strong>explicit consent</Strong> for us to process this
                  information for the purpose of operating the Platform. You can
                  withdraw this consent at any time by deleting your account.
                </>,
              )}
            </section>

            {/* 5. Sharing */}
            <section>
              {sectionHeading(SECTIONS[4])}
              {para(
                <>
                  <Strong>5.1 We do not sell your personal data.</Strong> We share
                  it only as described below.
                </>,
              )}
              {subHeading('5.2 With other users')}
              {list([
                'Your profile (display name, age, photos, bio, interests, mood, approximate distance) is visible to other users when you are active on the Platform.',
                'Your exact GPS coordinates are never visible to other users.',
                <>
                  Ghost mode and Incognito browsing prevent other users from seeing
                  you in discovery while you continue to browse (see also our{' '}
                  <Link
                    to="/terms"
                    className="text-[#c8861c] hover:text-[#d9a038] hover:underline"
                  >
                    Terms
                  </Link>
                  ).
                </>,
              ])}
              {subHeading('5.3 With service providers (data processors)')}
              {list([
                <>
                  <Strong>Stripe</Strong> — payment processing.
                </>,
                <>
                  <Strong>Identity verification provider</Strong> — checking the
                  authenticity of your government ID and selfie.
                </>,
                <>
                  <Strong>Email provider</Strong> — sending transactional and
                  marketing emails.
                </>,
                <>
                  <Strong>Push-notification provider</Strong> — delivering
                  notifications to your device.
                </>,
                <>
                  <Strong>Cloud hosting (Vercel, Railway, Supabase)</Strong> —
                  storing and serving your data.
                </>,
                <>
                  <Strong>Analytics and crash reporting</Strong> — measuring how
                  the Platform performs and diagnosing errors.
                </>,
              ])}
              {para(
                <>
                  All processors are bound by contract to use your data only on our
                  instructions and to keep it confidential and secure.
                </>,
              )}
              {subHeading('5.4 For legal reasons')}
              {list([
                'To comply with valid court orders, subpoenas, or law-enforcement requests.',
                'To enforce our Terms, investigate suspected violations, or protect the rights, property, or safety of MenRush, our users, or the public.',
                'In connection with a corporate transaction (merger, acquisition, asset sale) — your data may be transferred to the new entity, subject to the same protections in this policy.',
              ])}
            </section>

            {/* 6. Location */}
            <section>
              {sectionHeading(SECTIONS[5])}
              <aside
                role="note"
                className="mt-6 rounded-r border-l-[3px] border-[#c8861c] bg-[#1e1208] p-4 text-[15px] leading-[1.7] text-[#f0e4cc]/90"
              >
                <Strong>How we protect your location.</Strong> Your raw GPS
                coordinates are stored on our servers in encrypted form, used only
                to compute proximity to other users, and never displayed to anyone
                else. Distance is shown to other users as a rounded approximation
                (e.g. "around 500 m away"), not as your exact position on a map.
              </aside>
              {para(
                <>
                  <Strong>6.1</Strong> Location is collected only when you actively
                  enable it. You can disable it at any time through your device
                  settings; doing so will limit core Platform functionality.
                </>,
              )}
              {para(
                <>
                  <Strong>6.2</Strong> Ghost mode lets you hide your location from
                  other users entirely while continuing to browse.
                </>,
              )}
              {para(
                <>
                  <Strong>6.3</Strong> Location data is retained for up to{' '}
                  <Strong>6 months</Strong> for safety, anti-abuse, and
                  service-improvement purposes, then deleted or anonymised. See §10
                  for full retention timelines.
                </>,
              )}
            </section>

            {/* 7. Verification */}
            <section>
              {sectionHeading(SECTIONS[6])}
              {para(
                <>
                  <Strong>7.1</Strong> ID verification is{' '}
                  <Strong>entirely optional</Strong> and free to all users. You
                  receive a verified badge on your profile once you pass.
                </>,
              )}
              {para(
                <>
                  <Strong>7.2</Strong> The ID document and selfie are submitted
                  directly to our verification provider (a regulated identity-check
                  company). MenRush receives only the pass/fail result and a
                  verified-status flag — we do not store your raw ID document on
                  our own servers.
                </>,
              )}
              {para(
                <>
                  <Strong>7.3</Strong> Profile photos you upload are stored on our
                  servers and visible to other users. Photos in private albums are
                  visible only to users you have granted access to. Disappearing
                  photos in messages are deleted from our servers after they are
                  viewed or expire.
                </>,
              )}
              {para(
                <>
                  <Strong>7.4</Strong> You can delete any photo at any time from
                  your profile. Deletion from our active storage is immediate;
                  encrypted backups may retain copies for up to 30 days before they
                  are overwritten.
                </>,
              )}
            </section>

            {/* 8. Cookies */}
            <section>
              {sectionHeading(SECTIONS[7])}
              {para(
                <>
                  We use first- and third-party cookies and similar technologies
                  for authentication, security, analytics, and performance
                  measurement. For the full list, durations, and how to control
                  them, see our{' '}
                  <Link
                    to="/cookies"
                    className="text-[#c8861c] hover:text-[#d9a038] hover:underline"
                  >
                    Cookie Policy
                  </Link>
                  .
                </>,
              )}
            </section>

            {/* 9. International transfers */}
            <section>
              {sectionHeading(SECTIONS[8])}
              {para(
                <>
                  <Strong>9.1</Strong> MenRush is based in the United Kingdom. Some
                  of our service providers (e.g. cloud hosting, payment processing,
                  identity verification) may process your data in the European
                  Economic Area, the United States, or other countries.
                </>,
              )}
              {para(
                <>
                  <Strong>9.2</Strong> When we transfer personal data outside the
                  UK or EEA, we ensure an adequate level of protection through one
                  of the following safeguards:
                </>,
              )}
              {list([
                'A UK or EU adequacy decision covering the destination country.',
                'Standard Contractual Clauses (SCCs) approved by the UK Information Commissioner or European Commission.',
                'The UK International Data Transfer Agreement or UK Addendum to the EU SCCs.',
              ])}
            </section>

            {/* 10. Retention */}
            <section>
              {sectionHeading(SECTIONS[9])}
              {para(
                <>
                  <Strong>10.1</Strong> We keep your personal data only for as long
                  as we need it for the purposes set out in this policy, or longer
                  if required by law.
                </>,
              )}
              <div className="mt-6 overflow-x-auto rounded-xl border border-[#2e2418]">
                <table className="min-w-full text-[14px] leading-[1.6]">
                  <thead className="bg-[#0f0b07] text-[11px] uppercase tracking-[0.14em] text-[#c8861c]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Data</th>
                      <th className="px-4 py-3 text-left font-semibold">Retention</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#a89070]">
                    <tr className="border-t border-[#2e2418]">
                      <td className="px-4 py-3">
                        <Strong>Account &amp; profile</Strong>
                      </td>
                      <td className="px-4 py-3">For the life of your account.</td>
                    </tr>
                    <tr className="border-t border-[#2e2418] bg-[#0f0b07]/40">
                      <td className="px-4 py-3">
                        <Strong>Messages</Strong>
                      </td>
                      <td className="px-4 py-3">
                        For the life of your account. Disappearing messages are
                        deleted on view or expiry.
                      </td>
                    </tr>
                    <tr className="border-t border-[#2e2418]">
                      <td className="px-4 py-3">
                        <Strong>Location</Strong>
                      </td>
                      <td className="px-4 py-3">Up to 6 months.</td>
                    </tr>
                    <tr className="border-t border-[#2e2418] bg-[#0f0b07]/40">
                      <td className="px-4 py-3">
                        <Strong>Verification result</Strong>
                      </td>
                      <td className="px-4 py-3">
                        For the life of your account. Source ID document held only
                        by the verification provider per their policy.
                      </td>
                    </tr>
                    <tr className="border-t border-[#2e2418]">
                      <td className="px-4 py-3">
                        <Strong>Billing records</Strong>
                      </td>
                      <td className="px-4 py-3">
                        7 years (HMRC accounting requirement).
                      </td>
                    </tr>
                    <tr className="border-t border-[#2e2418] bg-[#0f0b07]/40">
                      <td className="px-4 py-3">
                        <Strong>Server &amp; security logs</Strong>
                      </td>
                      <td className="px-4 py-3">Up to 12 months.</td>
                    </tr>
                    <tr className="border-t border-[#2e2418]">
                      <td className="px-4 py-3">
                        <Strong>Deleted account residue</Strong>
                      </td>
                      <td className="px-4 py-3">
                        Removed from active systems immediately. Backups overwritten
                        within 30 days.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {para(
                <>
                  <Strong>10.2</Strong> If you ask us to delete your account, we
                  will remove your personal data from active systems immediately
                  and overwrite encrypted backups within 30 days, except for
                  records we are legally required to retain (e.g. billing).
                </>,
              )}
            </section>

            {/* 11. Rights */}
            <section>
              {sectionHeading(SECTIONS[10])}
              {para(
                <>
                  <Strong>11.1</Strong> Under UK and EU data-protection law, you
                  have the following rights:
                </>,
              )}
              {list([
                <>
                  <Strong>Access</Strong> — request a copy of the personal data we
                  hold about you.
                </>,
                <>
                  <Strong>Rectification</Strong> — correct inaccurate or incomplete
                  data.
                </>,
                <>
                  <Strong>Erasure</Strong> — ask us to delete your data ("the right
                  to be forgotten").
                </>,
                <>
                  <Strong>Restriction</Strong> — ask us to limit how we use your
                  data.
                </>,
                <>
                  <Strong>Portability</Strong> — receive your data in a structured,
                  machine-readable format.
                </>,
                <>
                  <Strong>Object</Strong> — object to processing based on
                  legitimate interests, including for direct marketing.
                </>,
                <>
                  <Strong>Withdraw consent</Strong> — withdraw any consent you have
                  given (without affecting the lawfulness of past processing).
                </>,
                <>
                  <Strong>No automated decision-making</Strong> — we do not make
                  decisions about you that produce legal or similarly significant
                  effects based solely on automated processing.
                </>,
              ])}
              {para(
                <>
                  <Strong>11.2 How to exercise your rights.</Strong> Email{' '}
                  <A href="mailto:privacy@menrush.com">privacy@menrush.com</A>. We
                  will respond within one month. Most rights can also be exercised
                  from within your account settings (download data, delete account,
                  manage marketing preferences).
                </>,
              )}
            </section>

            {/* 12. Children */}
            <section>
              {sectionHeading(SECTIONS[11])}
              <aside
                role="note"
                className="mt-6 rounded-r border-l-[3px] border-[#c8861c] bg-[#1e1208] p-4 text-[15px] leading-[1.7] text-[#f0e4cc]/90"
              >
                <Strong>18 and over only.</Strong> MenRush is not intended for and
                must not be used by anyone under the age of 18. If we discover that
                we have collected personal data from a person under 18, we will
                delete it immediately and terminate the account.
              </aside>
              {para(
                <>
                  <Strong>12.1</Strong> If you believe a minor is using MenRush,
                  please report it immediately to{' '}
                  <A href="mailto:privacy@menrush.com">privacy@menrush.com</A>.
                </>,
              )}
            </section>

            {/* 13. Security */}
            <section>
              {sectionHeading(SECTIONS[12])}
              {para(
                <>
                  <Strong>13.1</Strong> We use industry-standard technical and
                  organisational measures to protect your data, including:
                </>,
              )}
              {list([
                'Encryption in transit (HTTPS / TLS) for all connections.',
                'Encryption at rest for sensitive fields and backups.',
                'Hashed passwords (never stored in plain text).',
                'Access controls and the principle of least privilege for staff.',
                'Regular security reviews and dependency updates.',
              ])}
              {para(
                <>
                  <Strong>13.2</Strong> No system is perfectly secure. If we
                  experience a personal-data breach that poses a risk to your
                  rights or freedoms, we will notify the UK Information
                  Commissioner's Office (ICO) within 72 hours and notify you
                  without undue delay where the risk is high.
                </>,
              )}
            </section>

            {/* 14. Changes */}
            <section>
              {sectionHeading(SECTIONS[13])}
              {para(
                <>
                  <Strong>14.1</Strong> We may update this Privacy Policy from time
                  to time. The "Last updated" date at the top of the policy will
                  always reflect the latest revision.
                </>,
              )}
              {para(
                <>
                  <Strong>14.2</Strong> For material changes (e.g. new categories of
                  data, new purposes), we will notify you by email or through the
                  Platform before the change takes effect.
                </>,
              )}
              {para(
                <>
                  <Strong>14.3</Strong> The current version of this policy is always
                  available at{' '}
                  <A href="https://menrush.com/privacy">menrush.com/privacy</A>.
                </>,
              )}
            </section>

            {/* 15. Complaints */}
            <section>
              {sectionHeading(SECTIONS[14])}
              {para(
                <>
                  <Strong>15.1</Strong> If you are unhappy with how we have handled
                  your personal data, please contact us first at{' '}
                  <A href="mailto:privacy@menrush.com">privacy@menrush.com</A> so
                  we have the chance to put things right.
                </>,
              )}
              {para(
                <>
                  <Strong>15.2</Strong> You also have the right to lodge a complaint
                  with the supervisory authority in your country. In the United
                  Kingdom this is:
                </>,
              )}
              <div className="mt-5 rounded-2xl border border-[#2e2418] bg-[#0a0805]/70 p-5 sm:p-6">
                <p className="text-[15px] font-semibold text-[#f0e4cc]">
                  Information Commissioner's Office
                </p>
                <address className="mt-2 not-italic leading-[1.8] text-[15px] text-[#a89070]">
                  Wycliffe House, Water Lane
                  <br />
                  Wilmslow, Cheshire, SK9 5AF
                </address>
                <p className="mt-3 text-[14px] text-[#a89070]">
                  Telephone: 0303 123 1113 ·{' '}
                  <A href="https://ico.org.uk">ico.org.uk</A>
                </p>
              </div>
            </section>

            {/* 16. Contact */}
            <section>
              {sectionHeading(SECTIONS[15])}
              {para(<>For questions about this Privacy Policy or your data:</>)}
              <div className="mt-5 rounded-2xl border border-[#2e2418] bg-[#0a0805]/70 p-5 sm:p-6">
                <p className="text-[15px] font-semibold text-[#f0e4cc]">
                  Bronze Apps UK Limited{' '}
                  <span className="font-normal text-[#a89070]">
                    (doing business as MenRush)
                  </span>
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
                    Privacy
                  </dt>
                  <dd>
                    <A href="mailto:privacy@menrush.com">privacy@menrush.com</A>
                  </dd>

                  <dt className="font-semibold uppercase tracking-[0.12em] text-[#c8861c]/90 text-xs sm:text-[11px]">
                    Support
                  </dt>
                  <dd>
                    <A href="mailto:support@menrush.com">support@menrush.com</A>
                  </dd>

                  <dt className="font-semibold uppercase tracking-[0.12em] text-[#c8861c]/90 text-xs sm:text-[11px]">
                    Website
                  </dt>
                  <dd>
                    <A href="https://menrush.com">menrush.com</A>
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
              — End of Privacy Policy —
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
