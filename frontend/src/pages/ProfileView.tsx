import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { Layout } from '../components/Layout';
import { UserAvatar } from '../components/UserAvatar';
import { CoverBanner, normalizeCoverFrame } from '../components/CoverBanner';
import { StatusBadge } from '../components/StatusBadge';
import { ProfileAlbumsSection } from '../components/ProfileAlbumsSection';
import { ChatSafetyMenu } from '../components/ChatSafetyMenu';

interface ViewableUser {
  id: string;
  name: string;
  age?: number;
  bio?: string;
  headline?: string;
  looking_for?: string;
  photo_url?: string;
  cover_url?: string;
  cover_position_x?: number;
  cover_position_y?: number;
  cover_zoom?: number;
  interests?: string[];
  online?: boolean;
  last_seen?: string;
  is_match?: boolean;
  is_liked?: boolean;
}

const PROFILE_ERROR_MESSAGES: Record<string, string> = {
  profile_unavailable: 'This profile is not available right now.',
  target_unavailable: 'This user is no longer available.',
  user_not_found: 'Profile not found.',
  verification_required: 'Verify your ID to view profiles.',
  interaction_blocked: 'You cannot view this profile.',
};

function profileErrorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
  if (data?.code && PROFILE_ERROR_MESSAGES[data.code]) {
    return PROFILE_ERROR_MESSAGES[data.code];
  }
  if (data?.error && PROFILE_ERROR_MESSAGES[data.error]) {
    return PROFILE_ERROR_MESSAGES[data.error];
  }
  return data?.error || 'Could not load profile.';
}

export const ProfileView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const authUserId = useAuthStore((s) => s.user?.id);
  const [user, setUser] = useState<ViewableUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [mutual, setMutual] = useState(false);
  const [matching, setMatching] = useState(false);
  const [safetyNotice, setSafetyNotice] = useState<{ msg: string; tone: 'success' | 'error' } | null>(
    null,
  );

  useEffect(() => {
    if (!id) return;
    if (authUserId && id === authUserId) {
      navigate('/profile', { replace: true });
      return;
    }

    setLoading(true);
    usersAPI
      .getProfile(id)
      .then((r) => {
        const data = r.data as ViewableUser;
        setUser(data);
        setLiked(Boolean(data.is_liked || data.is_match));
        setMutual(Boolean(data.is_match));
        setError(null);
      })
      .catch((err) => {
        setError(profileErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [id, authUserId, navigate]);

  const flash = useCallback((msg: string, tone: 'success' | 'error' = 'success') => {
    setSafetyNotice({ msg, tone });
    window.setTimeout(() => setSafetyNotice(null), 4000);
  }, []);

  const handleMatch = useCallback(async () => {
    if (!user || matching) return;
    if (mutual) {
      navigate(`/messages/${user.id}`);
      return;
    }
    if (liked) {
      flash(`Match already sent to ${user.name}. Chat unlocks when he matches back · consent first.`);
      return;
    }
    setMatching(true);
    try {
      const res = await usersAPI.likeUser(user.id);
      setLiked(true);
      if (res.data?.match) {
        setMutual(true);
        flash(`You matched with ${user.name}. Say hello.`);
      } else {
        flash(`Match sent to ${user.name}. Chat unlocks if he matches back · consent first.`);
      }
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      flash(
        typeof apiError === 'string' && apiError.length > 0
          ? apiError
          : 'Could not send match. Try again.',
        'error',
      );
    } finally {
      setMatching(false);
    }
  }, [user, matching, mutual, liked, navigate, flash]);

  const handleMessage = useCallback(() => {
    if (!user) return;
    if (mutual) {
      navigate(`/messages/${user.id}`);
      return;
    }
    flash('Chat unlocks after a mutual match. Tap Match first · consent first.');
  }, [user, mutual, navigate, flash]);

  const handlePass = useCallback(() => {
    navigate(-1);
  }, [navigate]);

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
            onClick={() => navigate('/discover')}
            className="mt-4 px-4 py-2 rounded-xl bg-[#C4832A]/10 hover:bg-[#C4832A]/20 text-[#C4832A] text-xs font-semibold border border-[#C4832A]/30"
          >
            Back to Nearby
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 pb-10 space-y-4">
        {safetyNotice ? (
          <div
            role="status"
            className="rounded-xl border px-3 py-2 text-[12px] font-medium"
            style={{
              borderColor:
                safetyNotice.tone === 'success' ? 'rgba(143,199,115,0.4)' : 'rgba(196,131,42,0.45)',
              background:
                safetyNotice.tone === 'success' ? 'rgba(143,199,115,0.12)' : 'rgba(196,131,42,0.1)',
              color: safetyNotice.tone === 'success' ? '#8FC773' : '#F0E0C0',
            }}
          >
            {safetyNotice.msg}
          </div>
        ) : null}

        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl overflow-hidden shadow-card">
          {user.cover_url ? (
            <CoverBanner
              coverUrl={user.cover_url}
              frame={normalizeCoverFrame(
                user.cover_position_x,
                user.cover_position_y,
                user.cover_zoom,
              )}
            />
          ) : (
            <div className="h-40 sm:h-32 bg-gradient-to-br from-[#C4832A]/30 via-[#C4832A]/10 to-[#A45E18]/10" />
          )}
          <div className="px-5 pb-5">
            <div className="-mt-10 mb-3 flex items-end justify-between gap-2">
              <UserAvatar
                name={user.name}
                photoUrl={user.photo_url}
                age={user.age}
                online={user.online}
                size="xl"
                className="ring-4 ring-[#1E1508]"
              />
              <div className="flex items-center gap-1.5 pb-1">
                <StatusBadge online={!!user.online} lastSeen={user.last_seen} />
                <div className="rounded-full border border-[#3D2B0E] bg-[#0D0A06]/60">
                  <ChatSafetyMenu
                    peerId={user.id}
                    peerName={user.name}
                    onNotice={(msg, tone) => {
                      setSafetyNotice({ msg, tone: tone ?? 'success' });
                      window.setTimeout(() => setSafetyNotice(null), 4000);
                    }}
                    onBlocked={() => navigate('/discover', { replace: true })}
                  />
                </div>
              </div>
            </div>
            <h2 className="text-xl font-bold text-[#F0E0C0]">{user.name}</h2>
            {typeof user.age === 'number' && (
              <p className="text-[var(--cream-muted)] text-sm mt-0.5">Age {user.age}</p>
            )}
            {user.headline && (
              <p className="text-[#F0E0C0]/80 text-sm mt-3 italic">{user.headline}</p>
            )}
            {user.bio && (
              <p className="text-[#F0E0C0]/65 text-sm mt-3 leading-relaxed">{user.bio}</p>
            )}
            {user.looking_for && (
              <p className="text-[var(--cream-muted)] text-xs mt-3">
                <span className="uppercase tracking-wide font-semibold">Looking for:</span>{' '}
                <span className="text-[#F0E0C0]/80">{user.looking_for}</span>
              </p>
            )}
            {user.interests && user.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {user.interests.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-[rgba(196,131,42,0.10)] text-[var(--copper)] text-xs font-medium border border-[rgba(196,131,42,0.25)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <ProfileAlbumsSection ownerId={user.id} ownerName={user.name} />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePass}
            className="flex-1 min-w-[5.5rem] py-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--cream)] font-bold text-sm hover:border-[var(--copper)] hover:text-[var(--copper)] transition-all"
          >
            Pass
          </button>
          <button
            type="button"
            disabled={matching}
            onClick={() => void handleMatch()}
            data-testid="profile-view-match"
            className={`flex-[1.4] min-w-[7rem] py-3 rounded-xl font-black text-sm tracking-wide active:scale-[0.98] transition-all disabled:opacity-60 ${
              mutual
                ? 'border border-[var(--copper)]/55 bg-[rgba(196,131,42,0.18)] text-[var(--copper)]'
                : liked
                  ? 'border border-[var(--copper)]/50 bg-transparent text-[var(--copper)]'
                  : 'bg-[var(--copper)] text-[var(--nn-on-copper)] hover:bg-[var(--copper-light,#E0A14A)]'
            }`}
          >
            {matching ? 'Sending…' : mutual ? 'Open chat' : liked ? 'Matched' : 'Match'}
          </button>
          <button
            type="button"
            onClick={handleMessage}
            data-testid="profile-view-message"
            className={`flex-1 min-w-[5.5rem] py-3 rounded-xl font-bold text-sm transition-all ${
              mutual
                ? 'border border-[var(--copper)]/40 text-[var(--copper)] hover:bg-[rgba(196,131,42,0.12)]'
                : 'border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--cream)] hover:border-[var(--copper)]/40 hover:text-[var(--copper)]'
            }`}
          >
            Message
          </button>
        </div>
        <p className="text-center text-[11px] text-[var(--cream-muted)]">
          Match is mutual interest · Chat unlocks when he matches back · Report anytime
        </p>
      </div>
    </Layout>
  );
};
