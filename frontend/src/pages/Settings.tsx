import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { NotificationSettings } from '../components/NotificationSettings';
import { TwoFactorSettings } from '../components/TwoFactorSettings';
import { PasswordInput } from '../components/PasswordInput';
import { authAPI, usersAPI } from '../api/client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { RadiusMilesSelect } from '../components/RadiusMilesSelect';
import { clampRadiusKm, formatRadiusMiles } from '../lib/discoveryFormat';
import { ROUTE_LABELS } from '../lib/routeLabels';
import {
  readThemePreference,
  setThemePreference,
  THEME_CHANGED_EVENT,
  type ThemePreference,
} from '../lib/theme';

const RADIUS_KEY = 'menrush_default_radius_km';

const fieldClass =
  'w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder:text-[var(--cream-faded)] outline-none focus:border-[var(--copper)]';

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-2 mt-5 first:mt-0 px-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--cream-muted)]">
      {children}
    </p>
  );
}

export const Settings = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const patchUser = useAuthStore((s) => s.patchUser);
  const storeEmail = useAuthStore((s) => s.user?.email);
  const setLocation = useLocationStore((s) => s.setLocation);
  const [savedRadius, setSavedRadius] = useState(() =>
    clampRadiusKm(Number(localStorage.getItem(RADIUS_KEY) ?? 5)),
  );
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [locating, setLocating] = useState(false);
  const [locNotice, setLocNotice] = useState('');

  const [accountEmail, setAccountEmail] = useState(storeEmail ?? '');
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [themePref, setThemePref] = useState<ThemePreference>(() => readThemePreference());
  const storeLat = useLocationStore((s) => s.lat);
  const storeLng = useLocationStore((s) => s.lng);

  useEffect(() => {
    usersAPI
      .getMe()
      .then((res) => {
        const lat = res.data?.lat != null ? Number(res.data.lat) : NaN;
        const lng = res.data?.lng != null ? Number(res.data.lng) : NaN;
        const ready = Number.isFinite(lat) && Number.isFinite(lng);
        setHasPin(ready);
        if (ready) setLocation(lat, lng);
      })
      .catch(() => setHasPin(null));

    authAPI
      .getAccount()
      .then((res) => {
        if (res.data?.email) {
          setAccountEmail(res.data.email);
          patchUser({ email: res.data.email });
        }
      })
      .catch(() => {});
  }, [setLocation, patchUser]);

  useEffect(() => {
    if (storeEmail) setAccountEmail(storeEmail);
  }, [storeEmail]);

  useEffect(() => {
    const onTheme = (e: Event) => {
      const detail = (e as CustomEvent<{ preference?: ThemePreference }>).detail;
      if (detail?.preference) setThemePref(detail.preference);
      else setThemePref(readThemePreference());
    };
    window.addEventListener(THEME_CHANGED_EVENT, onTheme);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, onTheme);
  }, []);

  // Keep Settings status in sync if GPS is published elsewhere.
  useEffect(() => {
    if (storeLat != null && storeLng != null && Number.isFinite(storeLat) && Number.isFinite(storeLng)) {
      setHasPin(true);
    }
  }, [storeLat, storeLng]);

  const enableDeviceLocation = useCallback(async () => {
    setLocNotice('');
    setLocating(true);
    try {
      const { requestDeviceLocation } = await import('../lib/deviceLocation');
      const result = await requestDeviceLocation();
      if (!result.ok) {
        setLocNotice(result.message);
        return;
      }
      try {
        await usersAPI.updateLocation(result.lat, result.lng);
        setLocation(result.lat, result.lng);
        setHasPin(true);
        const km = clampRadiusKm(Number(localStorage.getItem(RADIUS_KEY) ?? 5));
        setLocNotice(`Location is active. Showing people within ${formatRadiusMiles(km)}.`);
      } catch {
        setLocNotice('Could not save location. Check your connection.');
      }
    } finally {
      setLocating(false);
    }
  }, [setLocation]);

  const setRadius = (km: number) => {
    const clamped = clampRadiusKm(km);
    localStorage.setItem(RADIUS_KEY, String(clamped));
    setSavedRadius(clamped);
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError('Enter a valid email address.');
      return;
    }
    if (trimmed === accountEmail.trim().toLowerCase()) {
      setEmailError('New email must be different from your current email.');
      return;
    }
    if (!emailPassword) {
      setEmailError('Enter your current password to confirm.');
      return;
    }

    setEmailBusy(true);
    try {
      const res = await authAPI.changeEmail({
        current_password: emailPassword,
        new_email: trimmed,
      });
      const next = res.data.email ?? trimmed;
      setAccountEmail(next);
      patchUser({ email: next });
      setEmailSuccess('Email updated.');
      setNewEmail('');
      setEmailPassword('');
      setShowChangeEmail(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not change email.';
      setEmailError(msg);
    } finally {
      setEmailBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPwError('New password must be different from your current password.');
      return;
    }

    setPwBusy(true);
    try {
      await authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwSuccess('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowChangePassword(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not change password.';
      setPwError(msg);
    } finally {
      setPwBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[620px] px-6 py-6">
        <h1 className="mb-1 text-2xl font-extrabold text-[var(--cream)]">Settings</h1>
        <p className="mb-5 text-[13px] text-[var(--cream-muted)]">
          Account, location, and how you show up nearby.
        </p>

        <div className="space-y-2.5">
          <SectionLabel>Account</SectionLabel>

          <section className="mr-card p-4" data-testid="settings-email">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[var(--cream)]">Email</p>
                <p className="mt-1 break-all text-[13px] text-[var(--cream-muted)]">
                  {accountEmail || 'Loading…'}
                </p>
              </div>
              {!showChangeEmail ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeEmail(true);
                    setEmailError('');
                    setEmailSuccess('');
                    setNewEmail('');
                    setEmailPassword('');
                  }}
                  className="shrink-0 rounded-full border border-[rgba(196,131,42,0.4)] px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[#E0A14A] transition-colors hover:border-[var(--copper)] hover:bg-[rgba(196,131,42,0.1)]"
                >
                  Change
                </button>
              ) : null}
            </div>

            {emailSuccess && !showChangeEmail ? (
              <p className="mt-3 text-[13px] font-semibold text-[#8FC773]">{emailSuccess}</p>
            ) : null}

            {showChangeEmail ? (
              <form onSubmit={(e) => void handleChangeEmail(e)} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="settings-new-email" className="mb-1.5 block text-[12px] font-semibold text-[var(--cream-muted)]">
                    New email
                  </label>
                  <input
                    id="settings-new-email"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className={fieldClass}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="settings-email-password" className="mb-1.5 block text-[12px] font-semibold text-[var(--cream-muted)]">
                    Current password
                  </label>
                  <PasswordInput
                    id="settings-email-password"
                    value={emailPassword}
                    onChange={setEmailPassword}
                    autoComplete="current-password"
                    className={fieldClass}
                  />
                </div>
                {emailError ? <p className="text-[13px] text-[#E0A14A]">{emailError}</p> : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={emailBusy}
                    className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A] disabled:opacity-60"
                  >
                    {emailBusy ? 'Saving…' : 'Update email'}
                  </button>
                  <button
                    type="button"
                    disabled={emailBusy}
                    onClick={() => {
                      setShowChangeEmail(false);
                      setNewEmail('');
                      setEmailPassword('');
                      setEmailError('');
                    }}
                    className="rounded-full border border-[var(--border-default)] px-4 py-2 text-[12px] font-bold text-[var(--cream-muted)] transition-colors hover:border-[var(--cream-muted)] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="mr-card p-4" data-testid="settings-change-password">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-bold text-[var(--cream)]">Password</p>
                <p className="mt-1 text-[13px] text-[var(--cream-muted)]">
                  Change the password you use to sign in.
                </p>
              </div>
              {!showChangePassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassword(true);
                    setPwError('');
                    setPwSuccess('');
                  }}
                  className="shrink-0 rounded-full border border-[rgba(196,131,42,0.4)] px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[#E0A14A] transition-colors hover:border-[var(--copper)] hover:bg-[rgba(196,131,42,0.1)]"
                >
                  Change
                </button>
              ) : null}
            </div>

            {pwSuccess && !showChangePassword ? (
              <p className="mt-3 text-[13px] font-semibold text-[#8FC773]">{pwSuccess}</p>
            ) : null}

            {showChangePassword ? (
              <form onSubmit={(e) => void handleChangePassword(e)} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="settings-current-password" className="mb-1.5 block text-[12px] font-semibold text-[var(--cream-muted)]">
                    Current password
                  </label>
                  <PasswordInput
                    id="settings-current-password"
                    value={currentPassword}
                    onChange={setCurrentPassword}
                    autoComplete="current-password"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="settings-new-password" className="mb-1.5 block text-[12px] font-semibold text-[var(--cream-muted)]">
                    New password
                  </label>
                  <PasswordInput
                    id="settings-new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="settings-confirm-password" className="mb-1.5 block text-[12px] font-semibold text-[var(--cream-muted)]">
                    Confirm new password
                  </label>
                  <PasswordInput
                    id="settings-confirm-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                    className={fieldClass}
                  />
                </div>

                {pwError ? (
                  <p className="text-[13px] text-[#E0A14A]">{pwError}</p>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={pwBusy}
                    className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A] disabled:opacity-60"
                  >
                    {pwBusy ? 'Saving…' : 'Update password'}
                  </button>
                  <button
                    type="button"
                    disabled={pwBusy}
                    onClick={() => {
                      setShowChangePassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPwError('');
                    }}
                    className="rounded-full border border-[var(--border-default)] px-4 py-2 text-[12px] font-bold text-[var(--cream-muted)] transition-colors hover:border-[var(--cream-muted)] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="mr-card p-4">
            <p className="text-[15px] font-bold text-[var(--cream)]">Two-factor authentication</p>
            <p className="mt-1 text-[13px] text-[var(--cream-muted)]">
              Add an authenticator app on top of your password.
            </p>
            <div className="mt-4">
              <TwoFactorSettings />
            </div>
          </section>

          <SectionLabel>Appearance</SectionLabel>

          <section className="mr-card p-4" data-testid="settings-appearance">
            <p className="text-[15px] font-bold text-[var(--cream)]">Theme</p>
            <p className="mt-1 text-[13px] text-[var(--cream-muted)]">
              Light, dark, or match your device. Same control as the sun/bulb button on every screen.
            </p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Theme">
              {(
                [
                  { id: 'light' as const, label: 'Light' },
                  { id: 'dark' as const, label: 'Dark' },
                  { id: 'system' as const, label: 'System' },
                ]
              ).map((opt) => {
                const active = themePref === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setThemePref(opt.id);
                      setThemePreference(opt.id);
                    }}
                    className={`min-h-[44px] rounded-full px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide transition-colors ${
                      active
                        ? 'bg-[#C4832A] text-[#1A0E03]'
                        : 'border border-[var(--border-default)] text-[var(--cream-muted)] hover:border-[var(--copper)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          <SectionLabel>Location</SectionLabel>

          <section
            className={`mr-card p-4 ${
              hasPin === false
                ? 'border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.1)] shadow-[0_8px_24px_rgba(0,0,0,0.3)]'
                : hasPin
                  ? 'border-[rgba(143,199,115,0.35)]'
                  : ''
            }`}
            data-testid="settings-device-location"
          >
            <p className="text-[15px] font-bold text-[var(--cream)]">Device location</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--cream-muted)]">
              Needed for Nearby. Others see approximate distance only — not your exact public pin.
              In chat you can still send a one-time location message when you choose.
            </p>
            <p className="mt-2 text-[12px] font-semibold text-[var(--cream-muted)]">
              Status:{' '}
              <span className={hasPin ? 'text-[#8FC773]' : 'text-[#E0A14A]'}>
                {hasPin == null
                  ? '…'
                  : hasPin
                    ? `Active — within ${formatRadiusMiles(savedRadius)}`
                    : 'Off — invisible nearby'}
              </span>
            </p>
            {hasPin === false ? (
              <p className="mt-1 text-[12px] leading-relaxed text-[#E0A14A]">
                Without location you cannot appear near men. We use the pin privately for distance.
              </p>
            ) : null}
            {locNotice ? (
              <p
                className={`mt-1 text-[12px] ${
                  locNotice.startsWith('Location is active') ? 'text-[#8FC773]' : 'text-[#E0A14A]'
                }`}
              >
                {locNotice}
              </p>
            ) : null}
            <button
              type="button"
              disabled={locating}
              onClick={() => void enableDeviceLocation()}
              className="mt-3 min-h-[44px] rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A] disabled:opacity-60"
            >
              {locating ? 'Locating…' : hasPin ? 'Refresh location' : 'Allow location'}
            </button>
          </section>

          <SectionLabel>Discovery</SectionLabel>

          <section className="mr-card p-4">
            <p className="mb-3 text-[15px] font-bold text-[var(--cream)]">Default radius</p>
            <RadiusMilesSelect
              valueKm={savedRadius}
              onChange={setRadius}
              id="settings-default-radius"
              label="Default search radius"
            />
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

          <SectionLabel>Notifications</SectionLabel>

          <section className="mr-card p-4">
            <p className="text-[15px] font-bold text-[var(--cream)]">Push notifications</p>
            <p className="mt-1 text-[13px] text-[var(--cream-muted)]">Control alerts for messages and matches.</p>
            <div className="mt-4">
              <NotificationSettings />
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

          <SectionLabel>More</SectionLabel>

          <Link
            to="/verify"
            className="flex items-center gap-3.5 rounded-[14px] border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.08)] p-4 transition-colors hover:bg-[rgba(196,131,42,0.15)]"
          >
            <div className="flex-1">
              <p className="text-[15px] font-bold text-[var(--cream)]">ID verification</p>
              <p className="mt-1 text-[13px] text-[var(--cream-muted)]">
                Paused for beta — not required to use the app. You can still try the flow; we&apos;ll ask
                again at grand opening once it&apos;s fixed.
              </p>
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
            className="mt-2 w-full rounded-[14px] border border-[var(--border-default)] py-3.5 text-[15px] font-bold text-[#B0432E] transition-colors hover:border-[#B0432E]"
          >
            Sign out
          </button>
        </div>
      </div>
    </Layout>
  );
};
