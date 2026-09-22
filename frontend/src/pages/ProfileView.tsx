import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { Layout } from '../components/Layout';
import { UserAvatar, getPhotoUrl } from '../components/UserAvatar';
import { FadedBrandFace, isNearbyPlaceholderFace } from '../components/FadedBrandFace';
import { CoverBanner, normalizeCoverFrame } from '../components/CoverBanner';
import { ProfilePhotoViewer } from '../components/ProfilePhotoViewer';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { StatusBadge } from '../components/StatusBadge';
import { DistancePill } from '../components/DistancePill';
import { ProfileAlbumsSection } from '../components/ProfileAlbumsSection';
import { ChatSafetyMenu } from '../components/ChatSafetyMenu';
import { IconMatches, IconChat, IconUnmatch } from '../components/icons';
import { formatHeight, formatWeight } from '../lib/age';
import { formatDistanceFromKm } from '../lib/localeUnits';
import {
  matchCtaAriaLabel,
  matchCtaDisabled,
  matchCtaLabel,
  matchCtaToneClasses,
  matchInterestState,
} from '../lib/matchCta';

interface ViewableUser {
  is_verified?: boolean;
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
  /** Bucketed distance in km for locale formatting on the client. */
  distance_km?: string | number | null;
  /** Approximate distance label (privacy-bucketed). */
  distance_label?: string | null;
  interests?: string[];
  height_cm?: number | null;
  weight_kg?: number | null;
  relationship_status?: string | null;
  hosting_status?: string | null;
  sexual_health_status?: string | null;
  on_prep?: boolean | null;
  last_tested_at?: string | null;
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

/** Coerce API interests to string[] — null/object payloads previously crashed .map. */
export function normalizeInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0);
}

export function normalizeProfilePayload(raw: unknown): ViewableUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.id !== 'string' || typeof data.name !== 'string' || !data.name.trim()) {
    return null;
  }
  return {
    ...(data as unknown as ViewableUser),
    id: data.id,
    name: data.name,
    interests: normalizeInterests(data.interests),
  };
}

export const ProfileView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const authUserId = useAuthStore((s) => s.user?.id);
  const locationLat = useLocationStore((s) => s.lat);
  const locationLng = useLocationStore((s) => s.lng);
  const [user, setUser] = useState<ViewableUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [mutual, setMutual] = useState(false);
  const [matching, setMatching] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [safetyNotice, setSafetyNotice] = useState<{ msg: string; tone: 'success' | 'error' } | null>(
    null,
  );
  const [viewer, setViewer] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!id) {
      setUser(null);
      setError('Profile not found.');
      setLoading(false);
      return;
    }
    if (authUserId && id === authUserId) {
      navigate('/profile', { replace: true });
      return;
    }

    setLoading(true);
    usersAPI
      .getProfile(id, { lat: locationLat, lng: locationLng })
      .then((r) => {
        const data = normalizeProfilePayload(r.data);
        if (!data) {
          setUser(null);
          setError('Could not load profile.');
          return;
        }
        setUser(data);
        setLiked(Boolean(data.is_liked || data.is_match));
        setMutual(Boolean(data.is_match));
        setError(null);
      })
      .catch((err) => {
        setUser(null);
        setError(profileErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [id, authUserId, navigate, locationLat, locationLng]);

  const flash = useCallback((msg: string, tone: 'success' | 'error' = 'success') => {
    setSafetyNotice({ msg, tone });
    window.setTimeout(() => setSafetyNotice(null), 4000);
  }, []);

  const handleMatch = useCallback(async () => {
    if (!user || matching || mutual || liked) return;
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
  }, [user, matching, mutual, liked, flash]);

  const handleMessage = useCallback(() => {
    if (!user) return;
    if (mutual) {
      navigate(`/messages/${user.id}`);
      return;
    }
    flash('Chat unlocks after a mutual match. Tap Match first · consent first.');
  }, [user, mutual, navigate, flash]);

  const handleUnmatch = useCallback(async () => {
    if (!user || unmatching || !mutual) return;
    if (
      !window.confirm(
        `Unmatch with ${user.name}? Chat locks again until you both match.`,
      )
    ) {
      return;
    }
    setUnmatching(true);
    try {
      await usersAPI.unmatchUser(user.id);
      setMutual(false);
      setLiked(false);
      flash(`Unmatched with ${user.name}.`);
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      flash(
        typeof apiError === 'string' && apiError.length > 0
          ? apiError
          : 'Could not unmatch. Try again.',
        'error',
      );
    } finally {
      setUnmatching(false);
    }
  }, [user, unmatching, mutual, flash]);

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
          <p className="text-[var(--cream)]/80 text-sm">{error || 'Profile not found.'}</p>
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

  const matchState = matchInterestState({ liked, mutual });
  const coverSrc = user.cover_url ? getPhotoUrl(user.cover_url) : undefined;
  const photoSrc = user.photo_url ? getPhotoUrl(user.photo_url) : undefined;
  const distanceKmVal =
    user.distance_km != null && user.distance_km !== ''
      ? parseFloat(String(user.distance_km))
      : user.distance_label != null && user.distance_label.trim() !== ''
        ? parseFloat(user.distance_label.replace(/[^0-9.]/g, ''))
        : null;
  const distLabel =
    distanceKmVal != null && Number.isFinite(distanceKmVal)
      ? formatDistanceFromKm(distanceKmVal)
      : user.distance_label != null && user.distance_label.trim() !== ''
        ? user.distance_label
        : null;

  return (
    <Layout>
      <div className="mx-auto min-w-0 max-w-xl space-y-4 overflow-x-clip px-4 py-6 pb-10" data-testid="profile-view-shell">
        {safetyNotice ? (
          <div
            role="status"
            className="rounded-xl border px-3 py-2 text-[12px] font-medium"
            style={{
              borderColor:
                safetyNotice.tone === 'success' ? 'rgba(143,199,115,0.4)' : 'rgba(196,131,42,0.45)',
              background:
                safetyNotice.tone === 'success' ? 'rgba(143,199,115,0.12)' : 'rgba(196,131,42,0.1)',
              color: safetyNotice.tone === 'success' ? '#8FC773' : 'var(--cream)',
            }}
          >
            {safetyNotice.msg}
          </div>
        ) : null}

        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-card" data-testid="profile-view-body">
          {coverSrc ? (
            <button
              type="button"
              data-testid="profile-view-cover-enlarge"
              aria-label={`Enlarge ${user.name}'s cover`}
              className="block w-full cursor-zoom-in p-0 border-0 bg-transparent"
              onClick={() => setViewer({ src: coverSrc, alt: `${user.name}'s cover` })}
            >
              <CoverBanner
                coverUrl={user.cover_url!}
                frame={normalizeCoverFrame(
                  user.cover_position_x,
                  user.cover_position_y,
                  user.cover_zoom,
                )}
              />
            </button>
          ) : (
            <div className="h-40 sm:h-32 bg-gradient-to-br from-[#C4832A]/30 via-[#C4832A]/10 to-[#A45E18]/10" />
          )}
          <div className="px-5 pb-5">
            <div className="-mt-10 mb-3 flex items-end justify-between gap-2">
              {photoSrc && !isNearbyPlaceholderFace(user.photo_url) ? (
                <button
                  type="button"
                  data-testid="profile-view-avatar-enlarge"
                  aria-label={`Enlarge ${user.name}'s photo`}
                  className="rounded-full cursor-zoom-in p-0 border-0 bg-transparent"
                  onClick={() => setViewer({ src: photoSrc, alt: user.name })}
                >
                  <UserAvatar
                    name={user.name}
                    photoUrl={user.photo_url}
                    age={user.age}
                    online={user.online}
                    size="xl"
                    linkToProfile={false}
                    className="ring-4 ring-[var(--bg-card)]"
                  />
                </button>
              ) : isNearbyPlaceholderFace(user.photo_url) ? (
                <span
                  className="relative inline-flex shrink-0 overflow-hidden rounded-full ring-4 ring-[var(--bg-card)]"
                  style={{ width: 96, height: 96 }}
                  data-testid="profile-view-empty-brand-face"
                >
                  <FadedBrandFace
                    variant="profile"
                    size={96}
                    label={user.name}
                  />
                </span>
              ) : (
                <UserAvatar
                  name={user.name}
                  photoUrl={user.photo_url}
                  age={user.age}
                  online={user.online}
                  size="xl"
                  linkToProfile={false}
                  className="ring-4 ring-[var(--bg-card)]"
                />
              )}
              <div className="flex items-center gap-1.5 pb-1">
                <StatusBadge online={!!user.online} lastSeen={user.last_seen} />
                <div className="rounded-full border border-[var(--border-default)] bg-[var(--bg-primary)]/60">
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
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-[var(--cream)]">{user.name}</h2>{user.is_verified ? <VerifiedBadge /> : null}</div>
            <div className="flex flex-wrap items-center gap-2 text-sm mt-0.5">
              {typeof user.age === 'number' && (
                <span className="text-[var(--cream-muted)]">Age {user.age}</span>
              )}
              {distLabel && (
                <DistancePill
                  km={distanceKmVal ?? 0}
                  label={distLabel}
                  className="bg-black/40 text-[var(--cream)]/90"
                />
              )}
            </div>
            {(user.height_cm != null ||
              user.weight_kg != null ||
              user.relationship_status ||
              user.hosting_status) && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--cream-muted)]">
                {user.height_cm != null ? <span>{formatHeight(user.height_cm)}</span> : null}
                {user.weight_kg != null ? <span>{formatWeight(user.weight_kg)}</span> : null}
                {user.relationship_status ? <span>{user.relationship_status}</span> : null}
                {user.hosting_status ? <span>{user.hosting_status}</span> : null}
              </div>
            )}
            {user.headline && (
              <p className="text-[var(--cream)]/80 text-sm mt-3 italic">{user.headline}</p>
            )}
            {user.bio && (
              <p className="text-[var(--cream)]/65 text-sm mt-3 leading-relaxed">{user.bio}</p>
            )}
            {user.looking_for && (
              <p className="text-[var(--cream-muted)] text-xs mt-3">
                <span className="uppercase tracking-wide font-semibold">Looking for:</span>{' '}
                <span className="text-[var(--cream)]/80">{user.looking_for}</span>
              </p>
            )}
            {(user.sexual_health_status || user.on_prep != null || user.last_tested_at) && (
              <p className="text-[var(--cream-muted)] text-xs mt-2">
                <span className="uppercase tracking-wide font-semibold">Health:</span>{' '}
                <span className="text-[var(--cream)]/80">
                  {[
                    user.sexual_health_status,
                    user.on_prep === true ? 'On PrEP' : user.on_prep === false ? 'Not on PrEP' : null,
                    user.last_tested_at
                      ? `Last tested ${String(user.last_tested_at).slice(0, 10)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </p>
            )}
            {user.interests && user.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3" data-testid="profile-view-interests">
                {normalizeInterests(user.interests).map((tag) => (
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

        {mutual ? (
          <div
            data-testid="profile-view-matched-status"
            className="flex items-center justify-center gap-1.5 rounded-full border border-[var(--copper)]/35 bg-[rgba(196,131,42,0.12)] px-3.5 py-1.5 text-xs font-bold text-[#E0A14A]"
          >
            <IconMatches size={16} />
            <span>Matched with {user.name}</span>
          </div>
        ) : null}

        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 overflow-x-clip">
          {mutual ? (
            <>
              <button
                type="button"
                onClick={handleMessage}
                data-testid="profile-view-message"
                title="Chat"
                aria-label={`Chat with ${user.name}`}
                className="flex-1 min-w-[7rem] py-3 rounded-xl font-black text-sm tracking-wide active:scale-[0.98] transition-all border border-[var(--copper)]/55 bg-[rgba(196,131,42,0.18)] text-[var(--copper)] flex items-center justify-center gap-2 hover:bg-[rgba(196,131,42,0.28)]"
              >
                <IconChat size={20} />
                <span>Chat</span>
              </button>
              <button
                type="button"
                disabled={unmatching}
                onClick={() => void handleUnmatch()}
                data-testid="profile-view-unmatch"
                title="Unmatch"
                aria-label={`Unmatch with ${user.name}`}
                className="flex-1 min-w-[7rem] py-3 rounded-xl font-bold text-sm transition-all border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--cream)] hover:border-[#c45a4a]/55 hover:text-[#e08a7a] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <IconUnmatch size={20} />
                <span>{unmatching ? 'Unmatching…' : 'Unmatch'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={matchCtaDisabled(matchState, matching)}
                aria-disabled={matchCtaDisabled(matchState, matching)}
                aria-label={matchCtaAriaLabel(matchState, user.name)}
                title={matching ? 'Sending…' : matchState === 'outgoing' ? 'Sent' : 'Match'}
                onClick={() => void handleMatch()}
                data-testid="profile-view-match"
                className={`flex-1 min-w-[7rem] py-3 rounded-xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
                  matchState === 'none' ? 'uppercase active:scale-[0.98]' : ''
                } ${matchCtaToneClasses(matchState)}`}
              >
                <IconMatches size={20} />
                <span>{matching ? 'Sending…' : matchState === 'outgoing' ? 'Sent' : 'Match'}</span>
              </button>
              <button
                type="button"
                onClick={handleMessage}
                data-testid="profile-view-message"
                title="Chat"
                aria-label={`Chat with ${user.name}`}
                className="flex-1 min-w-[7rem] py-3 rounded-xl font-bold text-sm transition-all border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--cream)] hover:border-[var(--copper)]/40 hover:text-[var(--copper)] flex items-center justify-center gap-2"
              >
                <IconChat size={20} />
                <span>Chat</span>
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-[var(--cream-muted)]">
          Match is mutual interest · Chat unlocks when he matches back · Report anytime
        </p>
      </div>
      {viewer ? (
        <ProfilePhotoViewer
          src={viewer.src}
          alt={viewer.alt}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </Layout>
  );
};
