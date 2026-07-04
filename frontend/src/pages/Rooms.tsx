import { Layout } from '../components/Layout';
import { RoomList } from '../components/RoomList';

export const Rooms = () => {
  return (
    <Layout>
      <div className="flex h-[calc(100dvh-var(--mobile-header-height)-var(--mobile-tab-bar-height))] min-h-0 flex-col bg-[#0D0A06]">
        <RoomList variant="sidebar" className="h-full" />
      </div>
    </Layout>
  );
};
