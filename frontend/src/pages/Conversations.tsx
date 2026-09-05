import { Layout } from '../components/Layout';
import { ConversationList } from '../components/ConversationList';

/** Mobile Chat list — no Rooms tab; Video rooms are a separate chrome entry. */
export const Conversations = () => {
  return (
    <Layout>
      <div
        className="flex h-[calc(100dvh-var(--mobile-header-height)-var(--mobile-tab-bar-height))] min-h-0 min-w-0 max-w-full flex-col overflow-x-clip bg-[var(--bg-primary)]"
        data-testid="messaging-inbox"
      >
        <ConversationList variant="sidebar" showHeader={false} className="min-h-0 min-w-0 max-w-full flex-1" />
      </div>
    </Layout>
  );
};
