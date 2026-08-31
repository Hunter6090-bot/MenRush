import { Layout } from '../components/Layout';
import { RoomList } from '../components/RoomList';

/** Mobile Video rooms list — own surface, not nested under Chat. */
export const Rooms = () => {
  return (
    <Layout>
      <div className="flex h-[calc(100dvh-var(--mobile-header-height)-var(--mobile-tab-bar-height))] min-h-0 flex-col bg-[var(--bg-primary)]">
        <RoomList variant="sidebar" showHeader className="min-h-0 flex-1" />
      </div>
    </Layout>
  );
};
