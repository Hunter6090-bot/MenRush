import { Layout } from '../components/Layout';
import { ConversationList } from '../components/ConversationList';

export const Conversations = () => {
  return (
    <Layout>
      <div className="mx-auto max-w-xl px-4 py-4 pb-8">
        <ConversationList showHeader={false} />
      </div>
    </Layout>
  );
};
