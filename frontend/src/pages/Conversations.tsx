import { Layout } from '../components/Layout';
import { ConversationList } from '../components/ConversationList';

/** Mobile Chat list — no Rooms tab; Video rooms are a separate chrome entry. */
export const Conversations = () => {
  return (
    <Layout>
      {/*
        Fill the Layout page-enter flex slot (header/tab already padded).
        Avoid 100dvh−chrome math after #224 — that double-counts safe-area and
        can leave a vertical scrollport that fights visualViewport on iPhone.
      */}
      <div
        className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-x-clip bg-[var(--bg-primary)]"
        data-testid="messaging-inbox"
        style={{ touchAction: 'manipulation' }}
      >
        <ConversationList variant="sidebar" showHeader={false} className="min-h-0 min-w-0 max-w-full flex-1" />
      </div>
    </Layout>
  );
};
