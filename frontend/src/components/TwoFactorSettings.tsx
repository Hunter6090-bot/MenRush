import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { authAPI } from '../api/client';
import { PulseRing } from './PulseRing';
import {
  clearDeviceTrustToken,
  getStoredDeviceTrustToken,
} from '../lib/deviceTrust';

type SetupState = {
  secret: string;
  otpauthUrl: string;
} | null;

type TrustedDevice = {
  id: string;
  label: string | null;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent?: boolean;
};

export function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false);
  const [enabledAt, setEnabledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<SetupState>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const loadTrustedDevices = async () => {
    setDevicesLoading(true);
    try {
      const current = getStoredDeviceTrustToken();
      const res = await authAPI.listTrustedDevices(current);
      setDevices(res.data.devices ?? []);
    } catch {
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await authAPI.getTwoFactorStatus();
      setEnabled(!!res.data.enabled);
      setEnabledAt(res.data.enabledAt ?? null);
      if (res.data.enabled) {
        await loadTrustedDevices();
      } else {
        setDevices([]);
      }
    } catch {
      setError('Could not load two-factor status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const startSetup = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await authAPI.setupTwoFactor();
      setSetup(res.data);
      setMode('setup');
      setCode('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not start two-factor setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await authAPI.enableTwoFactor(code);
      setEnabled(true);
      setSetup(null);
      setMode('idle');
      setCode('');
      await loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await authAPI.disableTwoFactor(code);
      clearDeviceTrustToken();
      setEnabled(false);
      setEnabledAt(null);
      setDevices([]);
      setMode('idle');
      setCode('');
      setSetup(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const revokeDevice = async (device: TrustedDevice) => {
    setError('');
    setBusy(true);
    try {
      await authAPI.revokeTrustedDevice(device.id);
      if (device.isCurrent) clearDeviceTrustToken();
      await loadTrustedDevices();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not revoke device.');
    } finally {
      setBusy(false);
    }
  };

  const cancelFlow = () => {
    setMode('idle');
    setSetup(null);
    setCode('');
    setError('');
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--cream-muted)]">
        <PulseRing size={16} />
        Loading security settings…
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="two-factor-settings">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--cream)]">
            {enabled ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--cream-muted)]">
            Add a second step at sign-in with an authenticator app such as Google Authenticator, Authy, or 1Password.
          </p>
          {enabled && enabledAt ? (
            <p className="mt-1 text-[11px] text-[var(--cream-muted)]/80">
              Enabled {new Date(enabledAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>
        {enabled ? (
          <span className="shrink-0 rounded-full border border-[rgba(111,168,90,0.45)] bg-[rgba(111,168,90,0.12)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--status-online)]">
            Protected
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-[var(--border-default)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cream-muted)]">
            Optional
          </span>
        )}
      </div>

      {mode === 'setup' && setup ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/50 p-4">
          <p className="text-[13px] font-semibold text-[var(--cream)]">Scan this QR code</p>
          <p className="mt-1 text-[12px] text-[var(--cream-muted)]">
            Open your authenticator app, add a new account, then enter the 6-digit code below.
          </p>
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={setup.otpauthUrl} size={148} />
            </div>
            <div className="w-full sm:flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--cream-muted)]">
                Manual key
              </p>
              <p className="mt-1 break-all rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-[12px] text-[var(--copper)]">
                {setup.secret}
              </p>
            </div>
          </div>
          <label className="mt-4 block">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--cream-muted)]">
              Verification code
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              placeholder="000000"
              className="mt-1.5 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-center text-lg font-bold tracking-[0.35em] text-[var(--cream)] focus:border-[var(--copper)]/50 focus:outline-none"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void confirmEnable()}
              disabled={busy}
              className="rounded-full bg-[var(--copper)] px-4 py-2 text-sm font-bold text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Confirming…' : 'Turn on 2FA'}
            </button>
            <button
              type="button"
              onClick={cancelFlow}
              className="rounded-full border border-[var(--border-default)] px-4 py-2 text-sm font-semibold text-[var(--cream-muted)] hover:text-[var(--cream)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'disable' ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/50 p-4">
          <p className="text-[13px] font-semibold text-[var(--cream)]">Confirm with your authenticator code</p>
          <p className="mt-1 text-[12px] text-[var(--cream-muted)]">
            Enter a current code to turn off two-factor authentication.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            placeholder="000000"
            className="mt-3 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-center text-lg font-bold tracking-[0.35em] text-[var(--cream)] focus:border-[var(--copper)]/50 focus:outline-none"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void confirmDisable()}
              disabled={busy}
              className="rounded-full border border-[#B0432E] px-4 py-2 text-sm font-bold text-[#B0432E] transition-colors hover:bg-[#B0432E]/10 disabled:opacity-50"
            >
              {busy ? 'Turning off…' : 'Turn off 2FA'}
            </button>
            <button
              type="button"
              onClick={cancelFlow}
              className="rounded-full border border-[var(--border-default)] px-4 py-2 text-sm font-semibold text-[var(--cream-muted)] hover:text-[var(--cream)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#B0432E]">{error}</p> : null}

      {mode === 'idle' ? (
        <div>
          {enabled ? (
            <button
              type="button"
              onClick={() => {
                setMode('disable');
                setCode('');
                setError('');
              }}
              className="text-sm font-semibold text-[#B0432E] transition-colors hover:text-[#D96A52]"
            >
              Turn off two-factor authentication
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startSetup()}
              disabled={busy}
              className="rounded-full bg-[var(--copper)] px-4 py-2 text-sm font-bold text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Preparing…' : 'Set up authenticator app'}
            </button>
          )}
        </div>
      ) : null}

      {enabled && mode === 'idle' ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]/40 p-4">
          <p className="text-[13px] font-semibold text-[var(--cream)]">Trusted devices</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--cream-muted)]">
            Browsers you chose to trust can skip the authenticator code for 30 days. Password is always required.
          </p>
          {devicesLoading ? (
            <p className="mt-3 flex items-center gap-2 text-[12px] text-[var(--cream-muted)]">
              <PulseRing size={14} /> Loading…
            </p>
          ) : devices.length === 0 ? (
            <p className="mt-3 text-[12px] text-[var(--cream-muted)]">
              No trusted devices yet. Check “Trust this device” the next time you enter an authenticator code.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)]/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--cream)]">
                      {device.label || 'Trusted browser'}
                      {device.isCurrent ? (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--copper)]">
                          This device
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--cream-muted)]">
                      Last used {new Date(device.lastUsedAt).toLocaleDateString()} · Expires{' '}
                      {new Date(device.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revokeDevice(device)}
                    className="shrink-0 text-[12px] font-semibold text-[#B0432E] transition-colors hover:text-[#D96A52] disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
