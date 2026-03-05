import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagesAPI } from '../api/client';
import { ConversationItem } from '../components/ConversationItem';
import { Layout } from '../components/Layout';

interface Conversation {
  other_user_id: string;
  other_user_name: string;
  last_message_time: string;
}

export const Conversations = () => {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    messagesAPI
      .getConversations()
      .then((r) => setConvs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 pb-8">
        <h2 className="text-xl font-bold text-[#F2F4F8] mb-5">Messages</h2>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-[70px] bg-[#1A1D23] rounded-2xl border border-white/[0.06] animate-pulse"
              />
            ))}
          </div>
        ) : convs.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1A1D23] border border-white/[0.06] flex items-center justify-center">
              <ChatIcon className="w-8 h-8 text-[#4F8CFF]/50" />
            </div>
            <p className="text-[#F2F4F8]/60 font-medium mb-1">No conversations yet</p>
            <p className="text-[#F2F4F8]/30 text-sm mb-5">Find someone nearby and say hi</p>
            <button
              onClick={() => navigate('/discover')}
              className="px-5 py-2.5 rounded-xl bg-[#4F8CFF] hover:bg-[#3a6fe0] text-white text-sm font-semibold transition-all hover:shadow-glow-blue"
            >
              Discover People
            </button>
          </div>
        ) : (
          <div className="space-y-2 animate-fade-in">
            {convs.map((c) => (
              <ConversationItem
                key={c.other_user_id}
                userId={c.other_user_id}
                name={c.other_user_name}
                lastMessageTime={c.last_message_time}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

const ChatIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
