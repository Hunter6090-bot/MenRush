import { useNavigate } from 'react-router-dom';

type HubTab = 'messages' | 'rooms';

interface MobileHubTabsProps {
  active: HubTab;
}

export function MobileHubTabs({ active }: MobileHubTabsProps) {
  const navigate = useNavigate();

  return (
    <div
      className="shrink-0 border-b border-[var(--border-default)] px-4 py-3"
      role="tablist"
      aria-label="Messages and rooms"
    >
      <div className="flex rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] p-1">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'messages'}
          onClick={() => active !== 'messages' && navigate('/conversations')}
          className={`flex-1 rounded-full px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.12em] transition-colors ${
            active === 'messages'
              ? 'bg-[rgba(196,131,42,0.12)] text-[#E0A14A]'
              : 'text-[var(--cream-muted)]'
          }`}
        >
          Messages
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'rooms'}
          onClick={() => active !== 'rooms' && navigate('/rooms')}
          className={`flex-1 rounded-full px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.12em] transition-colors ${
            active === 'rooms'
              ? 'bg-[rgba(196,131,42,0.12)] text-[#E0A14A]'
              : 'text-[var(--cream-muted)]'
          }`}
        >
          Rooms
        </button>
      </div>
    </div>
  );
}