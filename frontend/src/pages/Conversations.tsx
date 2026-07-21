import { Layout } from '../components/Layout';
import { ConversationList } from '../components/ConversationList';
import { MobileHubTabs } from '../components/MobileHubTabs';

export const Conversations = () => {
  return (
    <Layout>
      <div className="flex h-[calc(100dvh-var(--mobile-header-height)-var(--mobile-tab-bar-height))] min-h-0 flex-col bg-[var(--bg-primary)]">
        <MobileHubTabs active="messages" />
        <ConversationList variant="sidebar" showHeader={false} className="min-h-0 flex-1" />
      </div>
    </Layout>
  );
};
