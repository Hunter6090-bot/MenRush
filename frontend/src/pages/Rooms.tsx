import { Layout } from '../components/Layout';
import { RoomList } from '../components/RoomList';

/** Mobile Video rooms list — own surface, not nested under Chat. */
export const Rooms = () => {
  return (
    <Layout>
      {/*
        Fill the Layout page-enter flex slot (header/tab already padded).
        Same phone-fit pattern as Conversations after #224/#226 — avoid
        100dvh−chrome double-counting safe-area on iPhone.
      */}
      <div
        className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-x-clip bg-[var(--bg-primary)]"
        data-testid="rooms-shell"
        style={{ touchAction: 'manipulation' }}
      >
        <RoomList variant="sidebar" showHeader className="min-h-0 min-w-0 max-w-full flex-1" />
      </div>
    </Layout>
  );
};
