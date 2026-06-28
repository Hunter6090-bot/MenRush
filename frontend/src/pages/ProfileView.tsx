import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { UserAvatar, getPhotoUrl } from '../components/UserAvatar';
import { StatusBadge } from '../components/StatusBadge';

interface ViewableUser {
  id: string;
  name: string;
  age?: number;
  bio?: string;
  headline?: string;
  looking_for?: string;
  photo_url?: string;
  cover_url?: string;
  interests?: string[];
  online?: boolean;
  last_seen?: string;
}

export const ProfileView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<ViewableUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    usersAPI
      .getProfile(id)
      .then((r) => {
        setUser(r.data);
        setError(null);
      })
      .catch((err) => {
        setError(err?.response?.data?.error || 'Could not load profile.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <svg className="w-8 h-8 text-[#C4832A] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      </Layout>
    );
  }

  if (error || !user) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-10 text-center">
          <p className="text-[#F0E0C0]/80 text-sm">{error || 'Profile not found.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 rounded-xl bg-[#C4832A]/10 hover:bg-[#C4832A]/20 text-[#C4832A] text-xs font-semibold border border-[#C4832A]/30"
          >
            Go back
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 pb-10 space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="text-[#A89070] text-xs hover:text-[#C4832A] transition-colors"
        >
          ← Back
        </button>

        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl overflow-hidden shadow-card">
          {user.cover_url ? (
            <div className="h-32">
              <img
                src={getPhotoUrl(user.cover_url)}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-32 bg-gradient-to-br from-[#C4832A]/30 via-[#C4832A]/10 to-[#8B4513]/10" />
          )}
          <div className="px-5 pb-5">
            <div className="-mt-10 mb-3 flex items-end justify-between">
              <UserAvatar
                name={user.name}
                photoUrl={user.photo_url}
                online={user.online}
                size="xl"
                className="ring-4 ring-[#1E1508]"
              />
              <StatusBadge online={!!user.online} lastSeen={user.last_seen} />
            </div>
            <h2 className="text-xl font-bold text-[#F0E0C0]">{user.name}</h2>
            {typeof user.age === 'number' && (
              <p className="text-[#A89070] text-sm mt-0.5">Age {user.age}</p>
            )}
            {user.headline && (
              <p className="text-[#F0E0C0]/80 text-sm mt-3 italic">{user.headline}</p>
            )}
            {user.bio && (
              <p className="text-[#F0E0C0]/65 text-sm mt-3 leading-relaxed">{user.bio}</p>
            )}
            {user.looking_for && (
              <p className="text-[#A89070] text-xs mt-3">
                <span className="uppercase tracking-wide font-semibold">Looking for:</span>{' '}
                <span className="text-[#F0E0C0]/80">{user.looking_for}</span>
              </p>
            )}
            {user.interests && user.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {user.interests.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-[#C4832A]/10 text-[#C4832A] text-xs font-medium border border-[#C4832A]/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
