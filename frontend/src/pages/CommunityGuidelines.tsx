import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';

const guidelines = [
  'Adults only. Everyone on MenRush must be 18 or older.',
  'Use your own photos and accurate profile information. Do not impersonate anyone.',
  'Consent first. No harassment, coercion, hate, outing, threats, or non-consensual intimate media.',
  'No exploitation, trafficking, paid sexual services, illegal drugs, weapons, scams, or blackmail.',
  'Respect trans, bi, discreet, curious and questioning men. Identity-based abuse is removed.',
  'Keep location use responsible. Do not stalk, follow, dox, or pressure someone to reveal private details.',
  'Report bad behaviour. Blocking is private; reports help keep the platform clean.',
];

export const CommunityGuidelines = () => {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0805] text-[#F0E0C0]">
      <main className="flex-1 px-5 py-8 sm:px-8 sm:py-12">
        <article className="mx-auto w-full max-w-3xl rounded-2xl border border-[#3D2B0E] bg-[#1A1410] p-6 sm:p-9">
          <Link to="/" className="text-xs font-bold uppercase tracking-[0.18em] text-[#A89070] hover:text-[#C4832A]">
            Back
          </Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[#C4832A]">Community guidelines</p>
          <h1 className="mr-page-heading mt-3">Direct does not mean disrespectful.</h1>
          <p className="mr-copy mt-4">
            MenRush is built for confident adult connection. These rules keep the room real,
            consensual and safe enough for discreet users to trust it.
          </p>
          <ol className="mt-8 space-y-3">
            {guidelines.map((item, index) => (
              <li key={item} className="flex gap-4 rounded-xl border border-[#3D2B0E]/80 bg-[#0D0A06]/60 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C4832A] text-sm font-black text-[#0D0A06]">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-6 text-[#F0E0C0]/86">{item}</p>
              </li>
            ))}
          </ol>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
};
