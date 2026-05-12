import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserAvatar, getPhotoUrl } from './UserAvatar';
import { StatusBadge } from './StatusBadge';
import { SilhouetteAvatar } from './SilhouetteAvatar';
import { usersAPI } from '../api/client';

export interface NearbyUser {
  id: string;
  name: string;
  age: number;
  bio?: string;
  headline?: string;
  photo_url?: string;
  interests?: string[];
  online: boolean;
  distance_km: string | number;
  /** Bucketed/privacy-safe distance label produced by the backend, e.g. "< 300m", "1.5km". */
  distance_label?: string;
  last_seen?: string;
  lat?: number;
  lng?: number;
  available_until?: string | null;
  is_verified?: boolean;
  is_pulsing?: boolean;
  pulse_expires_at?: string | null;
  /** Active mood (auto-expires after 6h server-side; null when unset/expired). */
  mood?: import('../api/client').Mood | null;
}

interface ProfileCardProps {
  user: NearbyUser;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const distance = parseFloat(String(user.distance_km));
  const fullPhotoUrl = getPhotoUrl(user.photo_url);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liked) return;

    try {
      const res = await usersAPI.likeUser(user.id);
      setLiked(true);
      if (res.data.match) {
        setShowMatch(true);
        setTimeout(() => setShowMatch(false), 3000);
      }
    } catch (err) {
      console.error('Failed to like user:', err);
    }
  };

  return (
    <div className="group relative bg-[#1E1508] border border-[#3D2B0E] rounded-2xl shadow-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover hover:border-[#C4832A]/25 flex flex-col">
      {/* Match Overlay */}
      {showMatch && (
        <div className="absolute inset-0 z-50 bg-[#C4832A]/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in text-white p-4 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 animate-bounce">
            <HeartIcon className="w-8 h-8 text-[#C4832A] fill-current" />
          </div>
          <h3 className="text-xl font-black tracking-tighter mb-1">IT'S A MATCH!</h3>
          <p className="text-xs font-medium opacity-90 mb-4">You and {user.name} liked each other.</p>
          <button
            onClick={() => navigate(`/messages/${user.id}`)}
            className="px-6 py-2 bg-white text-[#C4832A] rounded-full font-bold text-xs shadow-lg hover:scale-105 transition-transform"
          >
            Send Message
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
          <StatusBadge online={user.online} lastSeen={user.last_seen} />
        </div>

        {/* Distance badge */}
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-[#F0E0C0]/80 text-xs font-medium px-2.5 py-1 rounded-full border border-[#3D2B0E]">
            <PinIcon className="w-3 h-3 text-[#C4832A]" />
            {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
          </span>
        </div>

        {/* Like button overlay */}
        <button
          onClick={handleLike}
          className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            liked
              ? 'bg-[#8B4513] text-white shadow-glow-red'
              : 'bg-black/50 backdrop-blur-sm text-white hover:bg-[#8B4513] hover:scale-110'
          } border border-[#3D2B0E] z-10`}
        >
          <HeartIcon className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-[#F0E0C0] text-base">{user.name}</h3>
          <span className="text-[#A89070] text-sm">{user.age}</span>
        </div>

        {user.headline && (
          <p className="text-[#C4832A]/80 text-xs font-medium mb-1">{user.headline}</p>
        )}

        {user.bio ? (
          <p className="text-[#F0E0C0]/55 text-xs leading-relaxed line-clamp-2 flex-1">{user.bio}</p>
        ) : user.headline ? null : (
          <p className="text-[#A89070]/50 text-xs italic flex-1">No bio yet</p>
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
              <span className="px-2 py-0.5 rounded-full bg-[#3D2B0E]/40 text-[#A89070] text-[10px] border border-[#3D2B0E]">
                +{user.interests.length - 3}
              </span>
            )}
          </div>
        )}

        <button
          onClick={liked ? () => navigate(`/messages/${user.id}`) : handleLike}
          className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white text-sm font-semibold transition-all duration-200 hover:shadow-glow-blue active:scale-95"
        >
          {liked ? 'Message' : 'Like to Connect'}
        </button>
      </div>
    </div>
  );
};

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
  </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);
