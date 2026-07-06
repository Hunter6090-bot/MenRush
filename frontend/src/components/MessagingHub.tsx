import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { ConversationList } from './ConversationList';
import { RoomList } from './RoomList';
import { Messages } from '../pages/Messaging';
import { RoomChat } from '../pages/RoomChat';
import { IconChat, IconRooms } from './icons';

type HubTab = 'messages' | 'rooms';

function hubTabFromPath(pathname: string): HubTab {
  return pathname.startsWith('/rooms') ? 'rooms' : 'messages';
}

export const MessagingHub = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { otherId, roomId } = useParams<{ otherId?: string; roomId?: string }>();
  const tab = hubTabFromPath(location.pathname);

  const setTab = (next: HubTab) => {
    if (next === tab) return;
    navigate(next === 'rooms' ? '/rooms' : '/conversations');
  };

  return (
    <Layout>
      <div className="flex h-[calc(100dvh-var(--desktop-workspace-header))] min-h-0 overflow-hidden">
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[#0A0806]">
          <div className="shrink-0 border-b border-[var(--border-default)] px-4 py-4">
            <div
              className="flex rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] p-1"
              role="tablist"
              aria-label="Messages and rooms"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'messages'}
                onClick={() => setTab('messages')}
                className={`flex-1 rounded-full px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.12em] transition-colors ${
                  tab === 'messages'
                    ? 'bg-[rgba(196,131,42,0.12)] text-[#E0A14A]'
                    : 'text-[var(--cream-muted)] hover:text-[var(--cream)]'
                }`}
              >
                Messages
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'rooms'}
                onClick={() => setTab('rooms')}
                className={`flex-1 rounded-full px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.12em] transition-colors ${
                  tab === 'rooms'
                    ? 'bg-[rgba(196,131,42,0.12)] text-[#E0A14A]'
                    : 'text-[var(--cream-muted)] hover:text-[var(--cream)]'
                }`}
              >
                Rooms
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === 'messages' ? (
              <ConversationList activeUserId={otherId} variant="sidebar" showHeader={false} className="h-full" />
            ) : (
              <RoomList activeRoomId={roomId} variant="sidebar" showHeader={false} className="h-full" />
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#0D0A06]">
          {tab === 'messages' ? (
            otherId ? (
              <Messages embedded />
            ) : (
              <HubEmpty
                icon={<IconChat size={36} className="text-[var(--copper)]/50" />}
                title="Select a conversation"
                body="Pick someone from your inbox to read and reply, or start a chat from Nearby."
              />
            )
          ) : roomId ? (
            <RoomChat embedded />
          ) : (
            <HubEmpty
              icon={<IconRooms size={36} className="text-[var(--copper)]/50" />}
              title="Open a room"
              body="Select a group from the list to join the conversation, or create a new Premium group."
            />
          )}
        </section>
      </div>
    </Layout>
  );
};

function HubEmpty({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/60">
        {icon}
      </div>
      <h2 className="text-lg font-bold text-[var(--cream)]">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--cream-muted)]">{body}</p>
    </div>
  );
}
