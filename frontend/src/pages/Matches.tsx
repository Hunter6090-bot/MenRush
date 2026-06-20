import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { ConversationItem } from '../components/ConversationItem';
import { IconMatches } from '../components/icons';

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
            <h1 className="text-2xl font-black text-[#F0E0C0] tracking-tight">Your Matches</h1>
            <p className="text-[#A89070] text-sm mt-1">Your mutual connections</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-[72px] bg-[#1E1508] rounded-2xl border border-[#3D2B0E] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-[#F0E0C0]/70 text-sm">{error}</p>
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
          <div className="text-center py-24 bg-[#1E1508] rounded-3xl border border-[#3D2B0E]">
            <div className="w-16 h-16 bg-[#C4832A]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconMatches size={32} className="text-[#C4832A]/40" />
            </div>
            <h2 className="text-nn-text font-bold text-lg">No matches yet</h2>
            <p className="text-nn-muted text-sm mt-1 max-w-xs mx-auto">
              Signal people on Nearby. When it's mutual, they show up here.
            </p>
            <button
              onClick={() => navigate('/discover')}
              className="mt-6 px-6 py-2.5 bg-nn-copper hover:bg-nn-copper-bright text-[#1A0E03] rounded-full font-semibold text-sm transition-colors active:scale-95"
            >
              Go to Nearby
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};
