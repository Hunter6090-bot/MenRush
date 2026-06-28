import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';
import { BRAND_MEDALLION } from '../lib/brand';

const safetyRules = [
  {
    title: 'Meet in control',
    body: 'Use public or familiar places first, tell someone you trust where you are going, and leave if the vibe changes.',
  },
  {
    title: 'Protect your privacy',
    body: 'Do not share your home address, workplace, financial details, or identity documents in chat.',
  },
  {
    title: 'Consent is mandatory',
    body: 'No pressure, coercion, threats, harassment, stealthing, or non-consensual sharing of intimate media.',
  },
  {
    title: 'Report fast',
    body: 'Block and report anyone who is abusive, fake, underage, exploitative, or trying to move you into unsafe situations.',
  },
];

export const Safety = () => {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0805] text-[#F0E0C0]">
      <main className="flex-1 px-5 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto w-full max-w-4xl">
          <Link to="/" className="text-xs font-bold uppercase tracking-[0.18em] text-[#A89070] hover:text-[#C4832A]">
            Back
          </Link>
          <header className="mt-8 grid gap-8 rounded-2xl border border-[#3D2B0E] bg-[#1A1410] p-6 sm:p-8 md:grid-cols-[1fr_180px] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#C4832A]">Safety center</p>
              <h1 className="mr-page-heading mt-3">Real men. Clear boundaries.</h1>
              <p className="mr-copy mt-4 max-w-2xl">
                MenRush is for adult gay, bi, trans, discreet and curious men. The product is direct,
                but safety and consent are not optional. Verification, blocking, reporting, ghost mode
                and privacy controls are built into the experience.
              </p>
            </div>
            <img src={BRAND_MEDALLION} alt="MenRush" className="mx-auto h-36 w-36 rounded-full object-cover" />
          </header>

          <section className="mt-6 grid gap-3 sm:grid-cols-2">
            {safetyRules.map((item) => (
              <article key={item.title} className="rounded-2xl border border-[#3D2B0E] bg-[#120D08] p-5">
                <h2 className="text-lg font-bold text-[#F0E0C0]">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#A89070]">{item.body}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 rounded-2xl border border-[#8B4513]/45 bg-[#1E1208] p-5">
            <h2 className="text-lg font-bold">Urgent risk</h2>
            <p className="mt-2 text-sm leading-6 text-[#F0E0C0]/82">
              If someone is in immediate danger, contact local emergency services first. For account
              abuse, privacy concerns or illegal content, contact us at{' '}
              <a className="font-semibold text-[#C4832A] hover:underline" href="mailto:support@menrush.com">
                support@menrush.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};
