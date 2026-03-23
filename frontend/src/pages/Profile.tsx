import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { Layout } from '../components/Layout';
import { UserAvatar } from '../components/UserAvatar';
import { StatusBadge } from '../components/StatusBadge';
import { ImageGenerator } from '../components/ImageGenerator';

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
  headline?: string;
  looking_for?: string;
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
  const { user, token, setAuth, logout } = useAuthStore();
  const { lat, lng, setLocation } = useLocationStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [bio, setBio] = useState('');
  const [headline, setHeadline] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    usersAPI.getMe().then((r) => {
      const d: ProfileData = r.data;
      setProfile(d);
      setBio(d.bio ?? '');
      setHeadline(d.headline ?? '');
      setLookingFor(d.looking_for ?? '');
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await usersAPI.uploadPhoto(file);
      setPhotoUrl(res.data.photo_url);
      setProfile((p) => p ? { ...p, photo_url: res.data.photo_url } : p);
      if (user && token) setAuth({ ...user, photo_url: res.data.photo_url }, token);
      showToast('success', 'Photo uploaded!');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await usersAPI.updateProfile({ bio, headline, looking_for: lookingFor, photo_url: photoUrl || undefined, interests });
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
    'w-full bg-[#1E1508]/60 border border-[#3D2B0E] text-[#F0E0C0] placeholder:text-[#A89070]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C4832A]/50 transition-all';

  if (!profile) {
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

  return (
    <Layout>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-medium shadow-card border animate-slide-up ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
              : 'bg-[#8B4513]/15 border-[#8B4513]/25 text-[#F0E0C0]/80'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 py-6 pb-10 space-y-4">
        {/* ── Profile hero ── */}
        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl overflow-hidden shadow-card">
          {/* Cover gradient */}
          <div className="h-24 bg-gradient-to-br from-[#C4832A]/30 via-[#C4832A]/10 to-[#8B4513]/10" />
          {/* Avatar overlapping cover */}
          <div className="px-5 pb-5">
            <div className="-mt-10 mb-3 flex items-end justify-between">
              <UserAvatar
                name={profile.name}
                photoUrl={profile.photo_url}
                online={profile.online}
                size="xl"
                className="ring-4 ring-[#1E1508]"
              />
              <StatusBadge online={!!profile.online} lastSeen={profile.last_seen} />
            </div>
            <h2 className="text-xl font-bold text-[#F0E0C0]">{profile.name}</h2>
            <p className="text-[#A89070] text-sm mt-0.5">
              {profile.email} · Age {profile.age}
            </p>
            {profile.bio && (
              <p className="text-[#F0E0C0]/65 text-sm mt-3 leading-relaxed">{profile.bio}</p>
            )}
            {profile.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {profile.interests.map((tag) => (
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

        {/* ── Location card ── */}
        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl p-5 flex items-center justify-between shadow-card">
          <div>
            <p className="text-[#F0E0C0]/80 text-sm font-semibold">Your location</p>
            {lat && lng ? (
              <p className="text-[#A89070] text-xs mt-0.5">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            ) : (
              <p className="text-[#A89070]/50 text-xs mt-0.5">Not shared yet</p>
            )}
          </div>
          <button
            onClick={handleUpdateLocation}
            disabled={locating}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C4832A]/10 hover:bg-[#C4832A]/20 text-[#C4832A] text-xs font-semibold border border-[#C4832A]/20 transition-all disabled:opacity-50"
          >
            {locating ? <Spinner className="w-3.5 h-3.5" /> : <PinIcon className="w-3.5 h-3.5" />}
            {locating ? 'Locating…' : 'Update'}
          </button>
        </div>

        {/* ── Visibility card ── */}
        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl p-5 flex items-center justify-between shadow-card">
          <div>
            <p className="text-[#F0E0C0]/80 text-sm font-semibold">Profile visibility</p>
            <p className="text-[#A89070] text-xs mt-0.5">
              {isVisible ? 'You appear in nearby discovery' : 'Hidden from nearby discovery'}
            </p>
          </div>
          <button
            onClick={async () => {
              const next = !isVisible;
              setIsVisible(next);
              try {
                await usersAPI.updateVisibility(next);
                showToast('success', next ? 'Now visible to nearby users' : 'Profile hidden');
              } catch {
                setIsVisible(!next);
                showToast('error', 'Could not update visibility');
              }
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
              isVisible ? 'bg-[#C4832A]' : 'bg-[#3D2B0E]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                isVisible ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* ── Danger zone ── */}
        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl p-5 shadow-card flex items-center justify-between">
          <div>
            <p className="text-[#F0E0C0]/80 text-sm font-semibold">Sign out</p>
            <p className="text-[#A89070] text-xs mt-0.5">You'll need to log back in</p>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8B4513]/10 hover:bg-[#8B4513]/20 text-[#F0E0C0]/80 text-xs font-semibold border border-[#8B4513]/20 transition-all"
          >
            <LogoutIcon className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

        {/* ── AI Image Generator ── */}
        <ImageGenerator
          onSelectImage={(dataUrl) => {
            setPhotoUrl(dataUrl);
            showToast('success', 'AI image set as photo — save your profile to apply it.');
          }}
        />

        {/* ── Edit form ── */}
        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl p-5 shadow-card">
          <h3 className="text-[#F0E0C0] font-semibold mb-4">Edit Profile</h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#A89070] mb-1.5 uppercase tracking-wide">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself…"
                rows={3}
                maxLength={500}
                className="w-full bg-[#1E1508]/60 border border-[#3D2B0E] text-[#F0E0C0] placeholder:text-[#A89070]/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C4832A]/50 transition-all resize-none"
              />
              <p className="text-[10px] text-[#A89070]/60 mt-1 text-right">{bio.length}/500</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A89070] mb-1.5 uppercase tracking-wide">Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="One line about you…"
                maxLength={100}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A89070] mb-1.5 uppercase tracking-wide">Looking For</label>
              <input
                type="text"
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value)}
                placeholder="Dating, friends, fun, exploring…"
                maxLength={100}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A89070] mb-1.5 uppercase tracking-wide">
                Profile Photo
              </label>
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-[#A89070]/60 mt-1.5 px-1">
                    Enter a direct image URL or upload a file
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="photo-upload"
                    className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#1E1508]/60 border border-dashed border-[#3D2B0E] hover:border-[#C4832A]/50 hover:bg-[#C4832A]/5 cursor-pointer transition-all ${
                      uploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {uploading ? (
                      <Spinner className="w-5 h-5 text-[#C4832A]" />
                    ) : (
                      <UploadIcon className="w-5 h-5 text-[#A89070]" />
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className="block text-xs font-medium text-[#A89070] mb-2 uppercase tracking-wide">
                Interests <span className="normal-case text-[#A89070]/50">({interests.length}/10)</span>
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
                          ? 'bg-[#C4832A]/20 text-[#C4832A] border-[#C4832A]/40'
                          : maxed
                          ? 'bg-[#1E1508]/30 text-[#A89070]/20 border-[#3D2B0E]/30 cursor-not-allowed'
                          : 'bg-[#1E1508]/40 text-[#A89070] border-[#3D2B0E] hover:bg-[#3D2B0E]/60 hover:text-[#F0E0C0]/80'
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
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] disabled:opacity-50 text-white font-semibold text-sm transition-all hover:shadow-glow-blue active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {saving ? <><Spinner className="w-4 h-4" /> Saving…</> : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
  </svg>
);

const UploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
  </svg>
);

const Spinner = ({ className = '' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);
