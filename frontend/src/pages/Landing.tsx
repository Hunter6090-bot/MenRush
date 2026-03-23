import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/store';

const highlights = [
  {
    title: 'Live nearby discovery',
    body: 'See who is actually around you right now with map-first browsing, distance-aware cards, and fast filters.',
  },
  {
    title: 'Intentional matching',
    body: 'Like profiles quietly, unlock mutual matches, and move from discovery to conversation without leaving the app flow.',
  },
  {
    title: 'Real-time conversation',
    body: 'Presence, typing indicators, and instant delivery make intros feel closer to meeting than sending cold messages.',
  },
];

const moments = [
  {
    city: 'Shoreditch',
    title: 'Coffee in 12 minutes',
    copy: 'Matched on a shared obsession with film cameras and flat whites.',
    accent: 'from-[#4F8CFF]/35 via-[#6FB6FF]/15 to-transparent',
  },
  {
    city: 'Soho',
    title: 'Last-minute gallery run',
    copy: 'Found two people within 900m who were both free tonight.',
    accent: 'from-[#FF6B6B]/30 via-[#FF9B7A]/10 to-transparent',
  },
  {
    city: 'Camden',
    title: 'Running club, unlocked',
    copy: 'Used filters to find nearby fitness profiles before heading out.',
    accent: 'from-emerald-400/25 via-teal-300/10 to-transparent',
  },
];

const stats = [
  { value: '5km', label: 'default discovery radius' },
  { value: '1 tap', label: 'from match to message' },
  { value: 'Live', label: 'presence and typing signals' },
];

export const Landing = () => {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Navigate to="/discover" replace />;
  }

  return (
    <div className="min-h-dvh overflow-hidden bg-[#0C1018] text-[#F2F4F8]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-8%] h-[28rem] w-[28rem] rounded-full bg-[#4F8CFF]/20 blur-3xl" />
        <div className="absolute right-[-8%] top-[18%] h-[24rem] w-[24rem] rounded-full bg-[#FF6B6B]/14 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:80px_80px]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col px-5 pb-16 pt-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
          <Link to="/" className="text-lg font-black tracking-tight">
            NearNow
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#F2F4F8]/65 md:flex">
            <a href="#why" className="transition-colors hover:text-white">Why it works</a>
            <a href="#how" className="transition-colors hover:text-white">How it feels</a>
            <a href="#launch" className="transition-colors hover:text-white">Get started</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-[#F2F4F8]/75 transition-all hover:border-white/20 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-[#4F8CFF] px-4 py-2 text-sm font-semibold text-white shadow-glow-blue transition-all hover:bg-[#3f7df2]"
            >
              Join now
            </Link>
          </div>
        </header>

        <main className="flex-1">
          <section className="grid gap-10 pb-16 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-24 lg:pt-20">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#4F8CFF]/20 bg-[#4F8CFF]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#8bb6ff]">
                Location-first social discovery
              </div>
              <h1 className="max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                Meet people who are
                <span className="block bg-gradient-to-r from-[#F2F4F8] via-[#8bb6ff] to-[#FF9D7C] bg-clip-text text-transparent">
                  nearby right now.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#F2F4F8]/68 sm:text-lg">
                NearNow turns your city into a live social layer. Discover people around you, filter by vibe, match with intent, and start real-time conversations before the moment passes.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full bg-[#4F8CFF] px-6 py-3.5 text-sm font-semibold text-white shadow-glow-blue transition-all hover:-translate-y-0.5 hover:bg-[#3f7df2]"
                >
                  Create your profile
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-[#F2F4F8] transition-all hover:border-white/20 hover:bg-white/[0.08]"
                >
                  Explore the app
                </Link>
              </div>

              <div className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
                    <p className="text-2xl font-black tracking-tight text-white">{stat.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#F2F4F8]/42">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[32rem]">
              <div className="absolute inset-x-10 top-8 h-56 rounded-full bg-[#4F8CFF]/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                <div className="rounded-[1.6rem] border border-white/10 bg-[#101522]/95 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[#F2F4F8]/35">Tonight in London</p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight">Nearby energy</h2>
                    </div>
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      18 people live
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {moments.map((moment) => (
                      <article
                        key={moment.title}
                        className="relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${moment.accent}`} />
                        <div className="relative">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">{moment.title}</p>
                            <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[#F2F4F8]/55">
                              {moment.city}
                            </span>
                          </div>
                          <p className="mt-3 max-w-xs text-sm leading-6 text-[#F2F4F8]/68">{moment.copy}</p>
                          <div className="mt-4 flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.6)]" />
                            <span className="text-xs font-medium text-[#F2F4F8]/55">Fresh within the last few minutes</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="why" className="grid gap-4 py-8 lg:grid-cols-3">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-[1.8rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
                <div className="mb-5 h-12 w-12 rounded-2xl bg-gradient-to-br from-[#4F8CFF]/30 to-[#FF6B6B]/20" />
                <h3 className="text-xl font-bold tracking-tight text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#F2F4F8]/62">{item.body}</p>
              </article>
            ))}
          </section>

          <section id="how" className="mt-8 grid gap-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8bb6ff]">How it works</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Built for fast context, not endless swiping.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-[#F2F4F8]/66">
                NearNow combines live location, lightweight profile signals, and quick messaging so the experience feels immediate. You do not need a long setup or a cold start conversation to see momentum.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['1', 'Share your position', 'Update your location once and the app starts mapping nearby people.'],
                ['2', 'Filter the crowd', 'Use distance, age, and interests to shrink the field to the right energy.'],
                ['3', 'Match and talk', 'Like, match, and move into real-time chat while the moment is still live.'],
              ].map(([step, title, body]) => (
                <div key={step} className="rounded-[1.4rem] border border-white/10 bg-[#111726] p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4F8CFF]/15 text-sm font-black text-[#8bb6ff]">
                    {step}
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#F2F4F8]/56">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="launch" className="mt-8 grid gap-6 pb-8 pt-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FF9D7C]">Ready to launch</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Start building your local graph.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-[#F2F4F8]/66">
                Create an account, set your profile, and start nearby discovery. Existing users can jump straight back into active matches and conversations.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-[1.8rem] border border-white/10 bg-[linear-gradient(135deg,rgba(79,140,255,0.16),rgba(255,107,107,0.1))] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold text-white">NearNow is ready for first sessions.</p>
                <p className="mt-1 text-sm text-[#F2F4F8]/62">Join now or sign in to open the app.</p>
              </div>
              <div className="flex gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0F1728] transition-all hover:-translate-y-0.5"
                >
                  Get started
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-white/[0.08]"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
