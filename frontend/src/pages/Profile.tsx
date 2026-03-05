import React, { useEffect, useState } from 'react';
import { usersAPI } from '../api/client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { Layout } from '../components/Layout';
import { UserAvatar } from '../components/UserAvatar';
import { StatusBadge } from '../components/StatusBadge';

const INTEREST_OPTIONS = [
  'Travel', 'Music', 'Food', 'Sports', 'Art', 'Technology',
  'Gaming', 'Photography', 'Fitness', 'Movies', 'Books', 'Cooking',
  'Dancing', 'Hiking', 'Coffee', 'Fashion', 'Yoga', 'Skateboarding',
  'Climbing', 'Cycling',
];

interface ProfileData {
  id: string;
  name: string;
  email: string;
  age: number;
  bio?: string;
  photo_url?: string;
  interests?: string[];
  lat?: number;
  lng?: number;
  online?: boolean;
  last_seen?: string;
  created_at?: string;
}

type Toast = { type: 'success' | 'error'; msg: string };

export const Profile = () => {
  const { user, token, setAuth } = useAuthStore();
  const { lat, lng, setLocation } = useLocationStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    usersAPI.getMe().then((r) => {
      const d: ProfileData = r.data;
      setProfile(d);
      setBio(d.bio ?? '');
      setPhotoUrl(d.photo_url ?? '');
      setInterests(d.interests ?? []);
    });
  }, []);

  const showToast = (type: Toast['type'], msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 10 ? [...prev, tag] : prev
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await usersAPI.updateProfile({ bio, photo_url: photoUrl || undefined, interests });
      setProfile((p) => p ? { ...p, ...res.data } : p);
      if (user && token) setAuth({ ...user, bio, photo_url: photoUrl || undefined }, token);
      showToast('success', 'Profile saved!');
    } catch {
      showToast('error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLocation = () => {
    if (!navigator.geolocation) return showToast('error', 'Geolocation not supported.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await usersAPI.updateLocation(coords.latitude, coords.longitude);
          setLocation(coords.latitude, coords.longitude);
          showToast('success', 'Location updated!');
        } catch {
          showToast('error', 'Could not update location.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        showToast('error', 'Location access denied.');
        setLocating(false);
      }
    );
  };

  const inputClass =
    'w-full bg-white/[0.06] border border-white/[0.08] text-[#F2F4F8] placeholder:text-[#F2F4F8]/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all';

  if (!profile) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <svg className="w-8 h-8 text-[#4F8CFF] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-medium shadow-card border animate-slide-up ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
              : 'bg-[#FF6B6B]/15 border-[#FF6B6B]/25 text-[#FF6B6B]'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 py-6 pb-10 space-y-4">
        {/* ── Profile hero ── */}
        <div className="bg-[#1A1D23] border border-white/[0.06] rounded-2xl overflow-hidden shadow-card">
          {/* Cover gradient */}
          <div className="h-24 bg-gradient-to-br from-[#4F8CFF]/30 via-[#4F8CFF]/10 to-[#FF6B6B]/10" />
          {/* Avatar overlapping cover */}
          <div className="px-5 pb-5">
            <div className="-mt-10 mb-3 flex items-end justify-between">
              <UserAvatar
                name={profile.name}
                photoUrl={profile.photo_url}
                online={profile.online}
                size="xl"
                className="ring-4 ring-[#1A1D23]"
              />
              <StatusBadge online={!!profile.online} lastSeen={profile.last_seen} />
            </div>
            <h2 className="text-xl font-bold text-[#F2F4F8]">{profile.name}</h2>
            <p className="text-[#F2F4F8]/40 text-sm mt-0.5">
              {profile.email} · Age {profile.age}
            </p>
            {profile.bio && (
              <p className="text-[#F2F4F8]/65 text-sm mt-3 leading-relaxed">{profile.bio}</p>
            )}
            {profile.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {profile.interests.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-[#4F8CFF]/10 text-[#4F8CFF] text-xs font-medium border border-[#4F8CFF]/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Location card ── */}
        <div className="bg-[#1A1D23] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between shadow-card">
          <div>
            <p className="text-[#F2F4F8]/80 text-sm font-semibold">Your location</p>
            {lat && lng ? (
              <p className="text-[#F2F4F8]/35 text-xs mt-0.5">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            ) : (
              <p className="text-[#F2F4F8]/25 text-xs mt-0.5">Not shared yet</p>
            )}
          </div>
          <button
            onClick={handleUpdateLocation}
            disabled={locating}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#4F8CFF]/10 hover:bg-[#4F8CFF]/20 text-[#4F8CFF] text-xs font-semibold border border-[#4F8CFF]/20 transition-all disabled:opacity-50"
          >
            {locating ? <Spinner className="w-3.5 h-3.5" /> : <PinIcon className="w-3.5 h-3.5" />}
            {locating ? 'Locating…' : 'Update'}
          </button>
        </div>

        {/* ── Edit form ── */}
        <div className="bg-[#1A1D23] border border-white/[0.06] rounded-2xl p-5 shadow-card">
          <h3 className="text-[#F2F4F8] font-semibold mb-4">Edit Profile</h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#F2F4F8]/40 mb-1.5 uppercase tracking-wide">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself…"
                rows={3}
                maxLength={500}
                className="w-full bg-white/[0.06] border border-white/[0.08] text-[#F2F4F8] placeholder:text-[#F2F4F8]/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all resize-none"
              />
              <p className="text-[10px] text-[#F2F4F8]/25 mt-1 text-right">{bio.length}/500</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#F2F4F8]/40 mb-1.5 uppercase tracking-wide">
                Photo URL
              </label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className={inputClass}
              />
            </div>

            {/* Interests */}
            <div>
              <label className="block text-xs font-medium text-[#F2F4F8]/40 mb-2 uppercase tracking-wide">
                Interests <span className="normal-case text-[#F2F4F8]/20">({interests.length}/10)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((tag) => {
                  const active = interests.includes(tag);
                  const maxed = interests.length >= 10 && !active;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      disabled={maxed}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
                        active
                          ? 'bg-[#4F8CFF]/20 text-[#4F8CFF] border-[#4F8CFF]/40 shadow-glow-blue/20'
                          : maxed
                          ? 'bg-white/[0.03] text-[#F2F4F8]/20 border-white/[0.05] cursor-not-allowed'
                          : 'bg-white/[0.05] text-[#F2F4F8]/50 border-white/[0.08] hover:bg-white/10 hover:text-[#F2F4F8]/80'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-[#4F8CFF] hover:bg-[#3a6fe0] disabled:opacity-50 text-white font-semibold text-sm transition-all hover:shadow-glow-blue active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {saving ? <><Spinner className="w-4 h-4" /> Saving…</> : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
  </svg>
);

const Spinner = ({ className = '' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);
