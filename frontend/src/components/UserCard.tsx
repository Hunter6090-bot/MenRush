import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SilhouetteAvatar } from './SilhouetteAvatar';
import { DistancePill } from './DistancePill';
import { StatusBadge } from './StatusBadge';

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
  const distance = parseFloat(String(user.distance_km));

  return (
    <div className="bg-nn-card rounded-2xl shadow-card border border-nn-border hover:shadow-card-hover hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col">
      <div className="relative h-56 bg-gradient-to-br from-nn-elevated to-nn-card">
        {user.photo_url ? (
          <img src={user.photo_url} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <SilhouetteAvatar size={120} variant="card" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <StatusBadge online={user.online} lastSeen={user.last_seen} size="xs" />
        </div>
        <div className="absolute bottom-3 left-3">
          <DistancePill km={distance} />
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className="text-lg font-semibold text-nn-text">{user.name}</h3>
          <span className="text-sm text-nn-muted">{user.age}</span>
        </div>
        {user.bio ? (
          <p className="text-nn-muted text-sm line-clamp-2 flex-1">{user.bio}</p>
        ) : (
          <p className="text-nn-faint text-sm italic flex-1">No bio yet</p>
        )}
        <button
          onClick={() => navigate(`/messages/${user.id}`)}
          className="mt-4 w-full bg-nn-copper hover:bg-nn-copper-bright text-[#1A0E03] py-2.5 rounded-full text-sm font-semibold tracking-wide transition-colors active:scale-95"
        >
          Open chat
        </button>
      </div>
    </div>
  );
};
