import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SilhouetteAvatar } from './SilhouetteAvatar';

interface User {
  id: string;
  name: string;
  age: number;
  bio?: string;
  photo_url?: string;
  online: boolean;
  distance_km: string | number;
  last_seen?: string;
}

interface UserCardProps {
  user: User;
}

export const UserCard: React.FC<UserCardProps> = ({ user }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-[#1E1508] rounded-2xl shadow-card border border-[#3D2B0E] hover:shadow-card-hover transition-shadow overflow-hidden flex flex-col">
      {/* Photo */}
      <div className="relative h-56 bg-gradient-to-br from-[#2A1C0A] to-[#1E1508]">
        {user.photo_url ? (
          <img src={user.photo_url} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <SilhouetteAvatar size={120} variant="card" />
          </div>
        )}
        {/* Online badge */}
        <div className="absolute top-3 right-3">
          {user.online ? (
            <span className="flex items-center gap-1 bg-emerald-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full inline-block" />
              Online
            </span>
          ) : (
            <span className="bg-black/40 text-[#A89070] text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              Offline
            </span>
          )}
        </div>
        {/* Distance badge */}
        <div className="absolute bottom-3 left-3">
          <span className="bg-black/40 text-[#F0E0C0] text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm">
            📍 {parseFloat(String(user.distance_km)).toFixed(1)} km
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className="text-lg font-semibold text-[#F0E0C0]">{user.name}</h3>
          <span className="text-sm text-[#A89070]">{user.age}</span>
        </div>
        {user.bio ? (
          <p className="text-[#F0E0C0]/60 text-sm line-clamp-2 flex-1">{user.bio}</p>
        ) : (
          <p className="text-[#A89070]/60 text-sm italic flex-1">No bio yet</p>
        )}
        <button
          onClick={() => navigate(`/messages/${user.id}`)}
          className="mt-4 w-full bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] text-white py-2 rounded-lg text-sm font-semibold transition-all"
        >
          Send Message
        </button>
      </div>
    </div>
  );
};
