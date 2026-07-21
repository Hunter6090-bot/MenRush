import { Layout } from '../components/Layout';
import { RoomList } from '../components/RoomList';
import { MobileHubTabs } from '../components/MobileHubTabs';

export const Rooms = () => {
  return (
    <Layout>
      <div className="flex h-[calc(100dvh-var(--mobile-header-height)-var(--mobile-tab-bar-height))] min-h-0 flex-col bg-[var(--bg-primary)]">
        <MobileHubTabs active="rooms" />
        <RoomList variant="sidebar" showHeader={false} className="min-h-0 flex-1" />
      </div>
    </Layout>
  );
};
