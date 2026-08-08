import React from 'react';
import {
  USER_STATUS_ACCENT,
  USER_STATUS_LABELS,
  USER_STATUS_VALUES,
  type UserStatus,
} from '../lib/userStatus';

interface UserStatusPickerProps {
  current: UserStatus | null;
  onSelect: (status: UserStatus | null) => void | Promise<void>;
}

/** One-tap Status setter (§25). Independent of Mood/Pulse pickers. */
export const UserStatusPicker: React.FC<UserStatusPickerProps> = ({ current, onSelect }) => (
  <div className="flex flex-wrap gap-2" data-testid="user-status-picker" role="group" aria-label="Status">
    {USER_STATUS_VALUES.map((value) => {
      const active = current === value;
      const accent = USER_STATUS_ACCENT[value];
      return (
        <button
          key={value}
          type="button"
          onClick={() => void onSelect(active ? null : value)}
          className="rounded-full border px-3 py-2 text-xs font-semibold transition-all"
          style={{
            borderColor: active ? accent : 'var(--border-default)',
            background: active ? `${accent}22` : 'var(--bg-primary)',
            color: active ? 'var(--cream)' : '#C4A878',
          }}
          aria-pressed={active}
        >
          {USER_STATUS_LABELS[value]}
        </button>
      );
    })}
  </div>
);

export const UserStatusBadge: React.FC<{
  status: UserStatus | null | undefined;
  small?: boolean;
}> = ({ status, small = false }) => {
  if (!status) return null;
  const accent = USER_STATUS_ACCENT[status];
  return (
    <span
      data-testid="user-status-badge"
      className="inline-flex items-center gap-1.5 rounded-full border font-semibold"
      style={{
        borderColor: accent,
        background: `${accent}22`,
        color: 'var(--cream)',
        fontSize: small ? 10 : 12,
        padding: small ? '0.2rem 0.45rem' : '0.3rem 0.65rem',
      }}
    >
      <span
        aria-hidden
        className="rounded-full"
        style={{
          width: small ? 6 : 7,
          height: small ? 6 : 7,
          background: accent,
          boxShadow: `0 0 6px ${accent}88`,
        }}
      />
      {USER_STATUS_LABELS[status]}
    </span>
  );
};
