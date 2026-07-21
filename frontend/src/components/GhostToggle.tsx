import React from 'react';
import { Link } from 'react-router-dom';

interface GhostToggleProps {
  isGhost: boolean;
  isPremium: boolean;
  onToggle: (next: boolean) => void | Promise<void>;
}

export const GhostToggle: React.FC<GhostToggleProps> = ({ isGhost, isPremium, onToggle }) => {
  // Premium-gated when off and not subscribed — stay pressable so tap opens upgrade.
  const locked = !isPremium && !isGhost;

  return (
    <div
      className="rounded-2xl border p-5 shadow-card"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--cream)' }}>
              Ghost mode
            </p>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                borderColor: 'color-mix(in srgb, var(--copper) 35%, transparent)',
                background: 'color-mix(in srgb, var(--copper) 12%, transparent)',
                color: 'var(--copper)',
              }}
            >
              Premium
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--cream-muted)' }}>
            Browse quietly. When enabled, you stay off nearby discovery until you switch it back on.
          </p>
          {locked && (
            <Link
              to="/premium"
              className="mt-2 inline-block text-xs font-semibold hover:underline"
              style={{ color: 'var(--copper)' }}
            >
              Upgrade to unlock ghost mode
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onToggle(!isGhost)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            locked ? 'cursor-pointer opacity-80' : 'cursor-pointer'
          }`}
          style={{
            background: isGhost ? 'var(--copper)' : 'var(--border-default)',
            outlineColor: 'var(--copper)',
          }}
          aria-pressed={isGhost}
          aria-disabled={locked || undefined}
          aria-label={locked ? 'Ghost mode — Premium required. Tap to upgrade' : 'Toggle ghost mode'}
          title={locked ? 'Premium feature — tap to upgrade' : undefined}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              isGhost ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};
