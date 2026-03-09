import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserAvatar, getPhotoUrl } from './UserAvatar';
import { StatusBadge } from './StatusBadge';
import { usersAPI } from '../api/client';

export interface NearbyUser {
  id: string;
  name: string;
  age: number;
  bio?: string;
  photo_url?: string;
  interests?: string[];
  online: boolean;
  distance_km: string | number;
  last_seen?: string;
  lat?: number;
  lng?: number;
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
    <div className="group relative bg-[#222632] border border-white/[0.06] rounded-2xl shadow-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover hover:border-[#4F8CFF]/25 flex flex-col">
      {/* Match Overlay */}
      {showMatch && (
        <div className="absolute inset-0 z-50 bg-[#4F8CFF]/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in text-white p-4 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 animate-bounce">
            <HeartIcon className="w-8 h-8 text-[#4F8CFF] fill-current" />
          </div>
          <h3 className="text-xl font-black tracking-tighter mb-1">IT'S A MATCH!</h3>
          <p className="text-xs font-medium opacity-90 mb-4">You and {user.name} liked each other.</p>
          <button
            onClick={() => navigate(`/messages/${user.id}`)}
            className="px-6 py-2 bg-white text-[#4F8CFF] rounded-full font-bold text-xs shadow-lg hover:scale-105 transition-transform"
          >
            Send Message
          </button>
        </div>
      )}

      {/* Photo area */}
      <div className="relative h-52 bg-gradient-to-br from-[#272C3A] to-[#222632] flex-shrink-0">
        {fullPhotoUrl ? (
          <img
            src={fullPhotoUrl}
            alt={user.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-7xl font-black text-[#4F8CFF]/20">
              {user.name[0]?.toUpperCase()}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#222632] via-transparent to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <StatusBadge online={user.online} lastSeen={user.last_seen} />
        </div>

        {/* Distance badge */}
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-[#F2F4F8]/80 text-xs font-medium px-2.5 py-1 rounded-full border border-white/10">
            <PinIcon className="w-3 h-3 text-[#4F8CFF]" />
            {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
          </span>
        </div>

        {/* Like button overlay */}
        <button
          onClick={handleLike}
          className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            liked
              ? 'bg-[#FF6B6B] text-white shadow-glow-red'
              : 'bg-black/50 backdrop-blur-sm text-white hover:bg-[#FF6B6B] hover:scale-110'
          } border border-white/10 z-10`}
        >
          <HeartIcon className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-[#F2F4F8] text-base">{user.name}</h3>
          <span className="text-[#F2F4F8]/40 text-sm">{user.age}</span>
        </div>

        {user.bio ? (
          <p className="text-[#F2F4F8]/55 text-xs leading-relaxed line-clamp-2 flex-1">{user.bio}</p>
        ) : (
          <p className="text-[#F2F4F8]/25 text-xs italic flex-1">No bio yet</p>
        )}

        {/* Interest tags */}
        {user.interests && user.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {user.interests.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-[#4F8CFF]/10 text-[#4F8CFF] text-[10px] font-medium border border-[#4F8CFF]/20"
              >
                {tag}
              </span>
            ))}
            {user.interests.length > 3 && (
              <span className="px-2 py-0.5 rounded-full bg-white/5 text-[#F2F4F8]/30 text-[10px] border border-white/10">
                +{user.interests.length - 3}
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => navigate(`/messages/${user.id}`)}
          className="mt-4 w-full py-2.5 rounded-xl bg-[#4F8CFF] hover:bg-[#3a6fe0] text-white text-sm font-semibold transition-all duration-200 hover:shadow-glow-blue active:scale-95"
        >
          Message
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
