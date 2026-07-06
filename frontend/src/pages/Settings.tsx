import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { NotificationSettings } from '../components/NotificationSettings';
import { useAuthStore } from '../hooks/store';
import { DESKTOP_RADIUS_MILES } from '../lib/discoveryFormat';
import { ROUTE_LABELS } from '../lib/routeLabels';

const RADIUS_KEY = 'menrush_default_radius_km';

export const Settings = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const savedRadius = Number(localStorage.getItem(RADIUS_KEY) ?? 5);

  const setRadius = (km: number) => {
    localStorage.setItem(RADIUS_KEY, String(km));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[620px] px-6 py-6">
        <h1 className="mb-5 text-2xl font-extrabold text-[var(--cream)]">Settings</h1>

        <div className="space-y-2.5">
          <section className="mr-card p-4">
            <p className="text-[15px] font-bold text-[var(--cream)]">Push notifications</p>
            <p className="mt-1 text-[13px] text-[var(--cream-muted)]">Control alerts for messages and matches.</p>
            <div className="mt-4">
              <NotificationSettings />
            </div>
          </section>

          <section className="mr-card p-4">
            <p className="text-[15px] font-bold text-[var(--cream)]">Privacy & visibility</p>
            <p className="mt-1 text-[13px] text-[var(--cream-muted)]">Ghost mode, mood, and map visibility.</p>
            <Link
              to="/profile"
              className="mt-3 inline-flex text-sm font-semibold text-[var(--copper)] hover:text-[#E0A14A]"
            >
              Edit in profile →
            </Link>
          </section>

          <section className="mr-card p-4">
            <p className="mb-3 text-[15px] font-bold text-[var(--cream)]">Default radius</p>
            <div className="flex flex-wrap gap-2">
              {DESKTOP_RADIUS_MILES.map((mi) => (
                <button
                  key={mi}
                  type="button"
                  onClick={() => setRadius(mi)}
                  className={savedRadius === mi ? 'mr-pill mr-pill-active' : 'mr-pill mr-pill-inactive'}
                >
                  {mi} mile{mi === 1 ? '' : 's'}
                </button>
              ))}
            </div>
          </section>

          <Link
            to="/notifications"
            className="mr-card flex items-center justify-between p-4 transition-colors hover:border-[var(--copper)]/40"
          >
            <div>
              <p className="text-[15px] font-bold text-[var(--cream)]">Activity</p>
              <p className="mt-1 text-[13px] text-[var(--cream-muted)]">Messages, matches, and profile views.</p>
            </div>
            <span className="text-[13px] font-extrabold tracking-wide text-[#E0A14A]">OPEN</span>
          </Link>

          <Link
            to="/verify"
            className="flex items-center gap-3.5 rounded-[14px] border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.08)] p-4 transition-colors hover:bg-[rgba(196,131,42,0.15)]"
          >
            <div className="flex-1">
              <p className="text-[15px] font-bold text-[var(--cream)]">Verification</p>
              <p className="mt-1 text-[13px] text-[var(--cream-muted)]">Re-run the check or update your document.</p>
            </div>
            <span className="text-[13px] font-extrabold tracking-wide text-[#E0A14A]">OPEN</span>
          </Link>

          <Link
            to="/premium"
            className="mr-card block p-4 transition-colors hover:border-[var(--copper)]/40"
          >
            <p className="text-[15px] font-bold text-[var(--cream)]">{ROUTE_LABELS.profile} & Premium</p>
            <p className="mt-1 text-[13px] text-[var(--cream-muted)]">Manage subscription and profile editing.</p>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-[14px] border border-[var(--border-default)] py-3.5 text-[15px] font-bold text-[#B0432E] transition-colors hover:border-[#B0432E]"
          >
            Sign out
          </button>
        </div>
      </div>
    </Layout>
  );
};
