import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResolvingPhotoSrc } from './UserAvatar';
import { StatusBadge } from './StatusBadge';
import { SilhouetteAvatar } from './SilhouetteAvatar';
import { IconMatches } from './icons';
import { usersAPI } from '../api/client';
import { VerifiedBadge } from './VerifiedBadge';
import { MoodBadge } from './MoodPicker';
import { getDistanceLabel, isUserPulsing } from '../lib/discovery';

export interface NearbyUser {
  id: string;
  name: string;
  age: number;
  bio?: string;
  headline?: string;
  looking_for?: string;
  photo_url?: string;
  cover_url?: string;
  interests?: string[];
  online: boolean;
  distance_km: string | number;
  /** Bucketed/privacy-safe distance label produced by the backend, e.g. "< 300 m", "1.5 km". */
  distance_label?: string;
  last_seen?: string;
  lat?: number;
  lng?: number;
  available_until?: string | null;
  is_verified?: boolean;
  authenticity_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
  is_pulsing?: boolean;
  pulse_expires_at?: string | null;
  /** Active mood (auto-expires after 6h server-side; null when unset/expired). */
  mood?: import('../api/client').Mood | null;
}

interface ProfileCardProps {
  user: NearbyUser;
  /** Hydrate Match CTA after reload (mutual matches). */
  initiallyLiked?: boolean;
  initiallyMutual?: boolean;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  user,
  initiallyLiked = false,
  initiallyMutual = false,
}) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(initiallyLiked || initiallyMutual);
  const [isMutual, setIsMutual] = useState(initiallyMutual);
  const [showMatch, setShowMatch] = useState(false);
  const [likeHint, setLikeHint] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);
  const distance = parseFloat(String(user.distance_km));
  const distanceLabel = getDistanceLabel(user);
  const { src: fullPhotoUrl, onError: onPhotoError } = useResolvingPhotoSrc(
    user.photo_url,
    user.age,
  );
  const isPulsing = isUserPulsing(user);

  useEffect(() => {
    if (initiallyMutual || initiallyLiked) {
      setLiked(true);
      if (initiallyMutual) setIsMutual(true);
    }
  }, [initiallyLiked, initiallyMutual]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liking) return;
    if (liked || isMutual) {
      if (isMutual) navigate(`/messages/${user.id}`);
      return;
    }

    setLiking(true);
    setLikeHint(null);
    try {
      const res = await usersAPI.likeUser(user.id);
      setLiked(true);
      if (res.data.match) {
        setIsMutual(true);
        setShowMatch(true);
        setTimeout(() => setShowMatch(false), 3000);
      } else {
        setLikeHint('Match sent — chat unlocks if he matches back · consent first.');
        setTimeout(() => setLikeHint(null), 4000);
      }
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setLikeHint(
        typeof apiError === 'string' && apiError.length > 0
          ? apiError
          : 'Could not send match. Try again.',
      );
      setTimeout(() => setLikeHint(null), 4000);
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className="group relative bg-[#1E1508] border border-[#3D2B0E] rounded-2xl shadow-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover hover:border-[#C4832A]/25 flex flex-col">
      {/* Match Overlay */}
      {showMatch && (
        <div className="absolute inset-0 z-50 bg-[#C4832A]/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in text-[#1A0E03] p-4 text-center">
          <div className="w-16 h-16 bg-[#1A0E03] rounded-full flex items-center justify-center mb-4">
            <IconMatches size={32} className="text-[#C4832A]" />
          </div>
          <h3 className="font-display text-xl font-black tracking-wide uppercase mb-1">Match made.</h3>
          <p className="text-xs font-medium opacity-90 mb-4">You and {user.name} matched.</p>
          <button
            onClick={() => navigate(`/messages/${user.id}`)}
            className="px-6 py-2 bg-[#1A0E03] text-[#C4832A] rounded-full font-bold text-xs shadow-lg active:scale-95 transition-transform"
          >
            Open chat
          </button>
        </div>
      )}

      {/* Photo area */}
      <div className="relative h-52 bg-gradient-to-br from-[#2A1C0A] to-[#1E1508] flex-shrink-0">
        {fullPhotoUrl ? (
          <img
            src={fullPhotoUrl}
            alt={user.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={onPhotoError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <SilhouetteAvatar size={120} variant="card" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1E1508] via-transparent to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <StatusBadge online={user.online} lastSeen={user.last_seen} pulsing={isPulsing} />
        </div>

        {/* Distance badge */}
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-[#F0E0C0]/80 text-xs font-medium px-2.5 py-1 rounded-full border border-[#3D2B0E]">
            <PinIcon className="w-3 h-3 text-[#C4832A]" />
            {distanceLabel}
          </span>
        </div>

        {/* Match button overlay */}
        <button
          onClick={handleLike}
          className={`absolute bottom-3 right-3 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            liked
              ? 'bg-nn-copper text-nn-on-copper shadow-glow-copper'
              : 'bg-black/50 backdrop-blur-sm text-nn-copper-bright hover:bg-nn-copper/20 hover:scale-110'
          } border border-nn-border z-10`}
        >
          <IconMatches size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-[#F0E0C0] text-base">{user.name}</h3>
          <span className="text-[var(--cream-muted)] text-sm">{user.age}</span>
          {user.is_verified ? <VerifiedBadge /> : user.authenticity_status === 'verified' ? <VerifiedBadge level="authentic_person" /> : null}
        </div>

        {user.headline && (
          <p className="text-[#C4832A]/80 text-xs font-medium mb-1">{user.headline}</p>
        )}

        {user.looking_for ? (
          <p className="text-[11px] font-semibold text-[#E0A14A] mb-1" data-testid="card-looking-for">
            Looking for: {user.looking_for}
          </p>
        ) : null}

        {user.mood ? (
          <div className="mb-1.5">
            <MoodBadge mood={user.mood} small />
          </div>
        ) : null}

        {user.bio ? (
          <p className="text-[#F0E0C0]/55 text-xs leading-relaxed line-clamp-2 flex-1">{user.bio}</p>
        ) : user.headline || user.looking_for ? null : (
          <p className="text-[var(--cream-muted)]/50 text-xs italic flex-1">No bio yet</p>
        )}

        {/* Interest tags */}
        {user.interests && user.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {user.interests.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-[#C4832A]/10 text-[#C4832A] text-[10px] font-medium border border-[#C4832A]/20"
              >
                {tag}
              </span>
            ))}
            {user.interests.length > 3 && (
              <span className="px-2 py-0.5 rounded-full bg-[#3D2B0E]/40 text-[var(--cream-muted)] text-[10px] border border-[#3D2B0E]">
                +{user.interests.length - 3}
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={liking || (liked && !isMutual)}
          onClick={
            isMutual
              ? (e) => {
                  e.stopPropagation();
                  navigate(`/messages/${user.id}`);
                }
              : handleLike
          }
          className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#A45E18] hover:from-[#D4943B] hover:to-[#C4832A] text-white text-sm font-semibold transition-all duration-200 hover:shadow-glow-blue active:scale-95 disabled:opacity-60"
        >
          {liking ? 'Sending…' : isMutual ? 'Open chat' : liked ? 'Matched' : 'Match'}
        </button>
        {likeHint ? (
          <p className="mt-2 text-center text-[11px] text-[var(--cream-muted)]" role="status">
            {likeHint}
          </p>
        ) : null}
      </div>
    </div>
  );
};

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
  </svg>
);
