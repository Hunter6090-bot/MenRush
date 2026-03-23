import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { ConversationItem } from '../components/ConversationItem';

interface Match {
  id: string;
  name: string;
  age: number;
  bio?: string;
  photo_url?: string;
  online: boolean;
  last_seen?: string;
  last_message?: string;
  last_message_at?: string;
}

export const Matches = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await usersAPI.getMatches();
        setMatches(res.data);
      } catch (err) {
        setError('Could not load matches.');
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-[#F2F4F8] tracking-tight">Your Matches</h1>
            <p className="text-[#F2F4F8]/40 text-sm mt-1">Your mutual connections</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-[72px] bg-[#222632] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-[#FF6B6B] text-sm">{error}</p>
          </div>
        ) : matches.length > 0 ? (
          <div className="flex flex-col gap-3 animate-fade-in">
            {matches.map((match) => (
              <ConversationItem
                key={match.id}
                userId={match.id}
                name={match.name}
                photoUrl={match.photo_url}
                online={match.online}
                lastMessageTime={match.last_message_at}
                lastMessage={match.last_message ?? (match.online ? 'Active now — say hi!' : 'Say hello!')}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-[#222632] rounded-3xl border border-white/[0.03]">
            <div className="w-16 h-16 bg-[#4F8CFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <HeartIcon className="w-8 h-8 text-[#4F8CFF]/40" />
            </div>
            <h2 className="text-[#F2F4F8] font-bold text-lg">No matches yet</h2>
            <p className="text-[#F2F4F8]/30 text-sm mt-1 max-w-xs mx-auto">
              Keep exploring the discovery page and liking people you're interested in!
            </p>
            <button
              onClick={() => navigate('/discover')}
              className="mt-6 px-6 py-2.5 bg-[#4F8CFF] hover:bg-[#3a6fe0] text-white rounded-xl font-semibold text-sm transition-all"
            >
              Start Discovering
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

const HeartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);
