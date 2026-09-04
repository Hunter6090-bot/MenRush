import React from 'react';
import type { PresentPerson } from '../lib/roomPresentRoster';
import { getPhotoUrl } from './UserAvatar';

type Props = {
  people: PresentPerson[];
  activePeerId?: string | null;
  onSelect: (person: PresentPerson) => void;
  /** Narrow rail on desktop; compact strip on phone when collapsed=false. */
  className?: string;
};

/**
 * Side list of who is in the room NOW (present occupancy).
 * Shows room temp identity only — never navigates to main profile.
 */
export const RoomPresentPeopleList: React.FC<Props> = ({
  people,
  activePeerId,
  onSelect,
  className = '',
}) => {
  return (
    <aside
      className={`flex flex-col border-l border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-primary)_96%,transparent)] ${className}`}
      data-testid="room-present-people"
      aria-label="People in this room"
    >
      <div className="flex-shrink-0 border-b border-[var(--border-default)] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cream-muted)]">
          In room now
        </p>
        <p className="text-[11px] text-[var(--cream-muted)] opacity-80">
          {people.length === 0 ? 'Just you' : `${people.length} here`}
        </p>
      </div>
      <ul className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
        {people.length === 0 ? (
          <li className="px-2 py-3 text-xs text-[var(--cream-muted)]">
            Nobody else here yet. When someone joins, tap to open a private 1:1 inside this room.
          </li>
        ) : (
          people.map((person) => {
            const active = person.user_id === activePeerId;
            const src = getPhotoUrl(person.photo_url ?? undefined);
            return (
              <li key={person.user_id}>
                <button
                  type="button"
                  data-testid={`room-present-${person.user_id}`}
                  onClick={() => onSelect(person)}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--border-default)]/40 active:scale-[0.99]"
                  style={{
                    background: active ? 'rgba(196,131,42,0.14)' : undefined,
                    border: active ? '1px solid rgba(196,131,42,0.35)' : '1px solid transparent',
                  }}
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold"
                    style={{
                      background: 'rgba(196,131,42,0.18)',
                      border: '1px solid rgba(196,131,42,0.3)',
                      color: '#C4832A',
                    }}
                  >
                    {src ? (
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials(person.name)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--cream)]">
                      {person.name}
                    </span>
                    <span className="block text-[10px] text-[var(--cream-muted)]">
                      Tap for 1:1
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
