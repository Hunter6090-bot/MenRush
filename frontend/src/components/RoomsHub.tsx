import { useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { RoomList } from './RoomList';
import { RoomChat } from '../pages/RoomChat';
import { IconRooms } from './icons';

export const RoomsHub = () => {
  const { roomId } = useParams<{ roomId?: string }>();

  return (
    <Layout>
      <div className="flex h-[calc(100dvh-var(--desktop-workspace-header))] min-h-0 overflow-hidden">
        <aside className="flex w-[min(360px,34%)] min-w-[300px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[#0A0806]">
          <RoomList activeRoomId={roomId} variant="sidebar" />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#050403]">
          {roomId ? (
            <RoomChat embedded />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/60">
                <IconRooms size={36} className="text-[var(--copper)]/50" />
              </div>
              <h2 className="text-lg font-bold text-[var(--cream)]">Open a room</h2>
              <p className="mt-2 max-w-sm text-sm text-[var(--cream-muted)]">
                Select a group from the list to join the conversation, or create a new Premium group.
              </p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};
