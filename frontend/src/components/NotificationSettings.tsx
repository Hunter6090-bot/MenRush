import React, { useEffect, useState } from 'react';
import {
  PushSupport,
  getPushSupport,
  enablePushNotifications,
  disablePushNotifications,
  isPushConfigured,
} from '../lib/push';

/**
 * Notification settings card. The first permission prompt happens here, behind
 * a clear user action. Unsupported / blocked states are surfaced honestly
 * rather than pretending push is on.
 */
export const NotificationSettings: React.FC = () => {
  const [support, setSupport] = useState<PushSupport>(getPushSupport());
  const [busy, setBusy] = useState(false);
  const [serverConfigured, setServerConfigured] = useState(true);

  useEffect(() => {
    setSupport(getPushSupport());
    void isPushConfigured().then(setServerConfigured);
  }, []);

  const enabled = support === 'granted';

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (enabled) {
        await disablePushNotifications();
        setSupport(getPushSupport());
      } else {
        const result = await enablePushNotifications();
        setSupport(result);
      }
    } finally {
      setBusy(false);
    }
  };

  const description =
    !serverConfigured
      ? 'Push alerts are not configured on this server yet.'
      : support === 'unsupported'
        ? 'Your browser doesn’t support push notifications.'
        : support === 'denied'
          ? 'Blocked in your browser settings. Re-enable notifications for this site to turn them on.'
          : enabled
            ? 'Get alerts for new messages when MenRush is closed.'
            : 'Turn on alerts for new messages when MenRush is closed.';

  return (
    <div
      className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl p-5 flex items-center justify-between shadow-card"
      data-testid="notification-settings"
    >
      <div className="pr-4">
        <p className="text-[#F0E0C0]/80 text-sm font-semibold">Push notifications</p>
        <p className="text-[#A89070] text-xs mt-0.5" data-testid="notification-settings-status">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy || !serverConfigured || support === 'unsupported' || support === 'denied'}
        aria-pressed={enabled}
        aria-label="Toggle push notifications"
        data-testid="notification-settings-toggle"
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
          enabled ? 'bg-[#C4832A]' : 'bg-[#3D2B0E]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};
