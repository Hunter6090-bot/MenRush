import { Layout } from '../components/Layout';
import { ConversationList } from '../components/ConversationList';

export const Conversations = () => {
  return (
    <Layout>
      <div className="flex h-[calc(100dvh-var(--mobile-header-height)-var(--mobile-tab-bar-height))] min-h-0 flex-col bg-[#0D0A06]">
        <ConversationList variant="sidebar" className="h-full" />
      </div>
    </Layout>
  );
};
