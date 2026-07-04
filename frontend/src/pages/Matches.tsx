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
      <div className="mx-auto max-w-5xl px-4 py-4 pb-8 lg:px-8 lg:py-8">
        <div className="mb-6 hidden lg:block">
          <p className="nn-overline mb-1">Connections</p>
          <p className="text-sm text-[var(--cream-muted)]">Mutual likes — message anyone here directly.</p>
        </div>

        <div className="mb-5 flex items-center justify-between lg:hidden">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#F0E0C0]">Your Matches</h1>
            <p className="mt-1 text-sm text-[#A89070]">Your mutual connections</p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[88px] animate-pulse rounded-2xl border border-[#3D2B0E] bg-[#1E1508] lg:h-[220px]" />
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[#F0E0C0]/70">{error}</p>
          </div>
        ) : matches.length > 0 ? (
          <div className="animate-fade-in flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
            {matches.map((match) => (
              <div key={match.id} className="lg:rounded-2xl lg:border lg:border-[#3D2B0E] lg:bg-[#12100C]/80 lg:p-1 lg:shadow-card">
                <ConversationItem
                  userId={match.id}
                  name={match.name}
                  photoUrl={match.photo_url}
                  online={match.online}
                  lastMessageTime={match.last_message_at}
                  lastMessage={match.last_message ?? (match.online ? 'Active now — say hi!' : 'Say hello!')}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-[#1E1508] rounded-3xl border border-[#3D2B0E]">
            <div className="w-16 h-16 bg-[#C4832A]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconMatches size={32} className="text-[#C4832A]/40" />
            </div>
            <h2 className="text-nn-text font-bold text-lg">No matches yet</h2>
            <p className="text-nn-muted text-sm mt-1 max-w-xs mx-auto">
              Match people on Nearby. When it&apos;s mutual, they show up here.
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
