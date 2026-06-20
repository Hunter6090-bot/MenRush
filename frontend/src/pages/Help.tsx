import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';

const faqs = [
  {
    q: 'Who is MenRush for?',
    a: 'Adult gay, bi, trans, discreet and curious men who want real-time local discovery, chat and verified profiles.',
  },
  {
    q: 'Why do I need verification?',
    a: 'Verification reduces fake profiles and underage access. It protects the quality of the room and keeps MenRush premium.',
  },
  {
    q: 'Why does location matter?',
    a: 'Nearby discovery is the core product. We use location to show distance-bucketed results, not exact public coordinates.',
  },
  {
    q: 'What is Pulse?',
    a: 'Pulse makes you visible now and moves you higher in nearby lists for a limited time.',
  },
  {
    q: 'Can I be discreet?',
    a: 'Yes. Use limited profile details, Ghost mode and privacy controls. Never share private details until you choose to.',
  },
  {
    q: 'How do I get help?',
    a: 'Use the contact form or email support@menrush.com. For privacy requests, email privacy@menrush.com.',
  },
];

export const Help = () => {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0805] text-[#F0E0C0]">
      <main className="flex-1 px-5 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto w-full max-w-3xl">
          <Link to="/" className="text-xs font-bold uppercase tracking-[0.18em] text-[#A89070] hover:text-[#C4832A]">
            Back
          </Link>
          <header className="mt-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#C4832A]">Help</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Fast answers before you dive in.</h1>
          </header>
          <div className="mt-8 divide-y divide-[#3D2B0E] rounded-2xl border border-[#3D2B0E] bg-[#1A1410]">
            {faqs.map((item) => (
              <section key={item.q} className="p-5">
                <h2 className="text-base font-bold">{item.q}</h2>
                <p className="mt-2 text-sm leading-6 text-[#A89070]">{item.a}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};
