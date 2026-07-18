import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';

const sections = [
  {
    title: 'What we collect',
    items: [
      'Account details such as email, display name, age and encrypted login credentials.',
      'Profile content you choose to add, including photos, bio, interests, mood and preferences.',
      'Approximate location data when you use nearby discovery, Pulse, rooms or location features.',
      'Messages, media metadata, reports, blocks and safety signals needed to operate the service.',
      'Device, log and security information used to protect accounts and prevent abuse.',
    ],
  },
  {
    title: 'How we use it',
    items: [
      'To create your account, authenticate you and provide the MenRush app experience.',
      'To show nearby profiles using privacy-bucketed distance rather than exact public coordinates.',
      'To run verification, moderation, support, safety reviews and abuse prevention.',
      'To send transactional emails, waitlist updates and service notices.',
      'To improve product reliability, performance and launch readiness.',
    ],
  },
  {
    title: 'Your controls',
    items: [
      'You can edit profile details and visibility from your profile screen.',
      'You can use Ghost mode where available to reduce visibility.',
      'You can block or report users from relevant profile and chat surfaces.',
      'You can request access, correction or deletion by emailing privacy@menrush.com.',
      'You can unsubscribe from marketing emails using the unsubscribe link.',
    ],
  },
];

export const Privacy = () => {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0805] text-[#F0E0C0]">
      <main className="flex-1 px-5 py-8 sm:px-8 sm:py-12">
        <article className="mx-auto w-full max-w-4xl rounded-2xl border border-[#3D2B0E] bg-[#1A1410] p-6 sm:p-10">
          <Link to="/" className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)] hover:text-[#C4832A]">
            Back
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[#C4832A]">
            Privacy policy
          </p>
          <h1 className="mr-page-heading mt-3">Private by design, clear by default.</h1>
          <p className="mr-copy mt-4 max-w-3xl">
            MenRush handles sensitive adult, identity and location data. This policy explains the
            practical data use behind the product in direct language so members know what is collected,
            why it is needed, and how to control it.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {sections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-[#3D2B0E] bg-[#0D0A06]/55 p-5">
                <h2 className="text-lg font-bold">{section.title}</h2>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--cream-muted)]">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C4832A]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className="mt-6 rounded-2xl border border-[#3D2B0E] bg-[#0D0A06]/55 p-5">
            <h2 className="text-lg font-bold">Sharing and processors</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--cream-muted)]">
              We use trusted providers for hosting, email, analytics, payment, identity verification,
              support and security. We do not sell personal data. We only share data where needed to
              operate MenRush, comply with law, prevent harm, process user requests or protect the service.
            </p>
          </section>

          <section className="mt-6 rounded-2xl border border-[#3D2B0E] bg-[#0D0A06]/55 p-5">
            <h2 className="text-lg font-bold">Contact</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--cream-muted)]">
              Privacy requests: <a className="font-semibold text-[#C4832A] hover:underline" href="mailto:privacy@menrush.com">privacy@menrush.com</a>.
              Support and safety reports: <a className="font-semibold text-[#C4832A] hover:underline" href="mailto:support@menrush.com">support@menrush.com</a>.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
};
