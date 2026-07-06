import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usersAPI, profileMetaAPI, Mood, MOOD_LABELS } from '../api/client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { Layout } from '../components/Layout';
import { UserAvatar } from '../components/UserAvatar';
import { StatusBadge } from '../components/StatusBadge';
import { PulseRing } from '../components/PulseRing';
import { MoodPicker } from '../components/MoodPicker';
import { GhostToggle } from '../components/GhostToggle';
import { ProfileViewersCard, ProfileViewer } from '../components/ProfileViewersCard';
import { normalizeProfileImageFile } from '../lib/imageUpload';
import { CoverBanner, DEFAULT_COVER_FRAME, normalizeCoverFrame, type CoverFrame } from '../components/CoverBanner';
import { CoverPhotoEditor } from '../components/CoverPhotoEditor';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { QRCodeSVG } from 'qrcode.react';
import { profileUrl as buildProfileUrl } from '../lib/profileLinks';
import { getPhotoUrl } from '../components/UserAvatar';

const INTEREST_GROUPS: { label: string; tags: string[] }[] = [
  { label: 'Position', tags: ['Top', 'Vers Top', 'Vers', 'Vers Bottom', 'Bottom', 'Side'] },
  { label: 'Tribe', tags: ['Twink', 'Twunk', 'Otter', 'Bear', 'Cub', 'Daddy', 'Wolf', 'Jock', 'Leather', 'Rugged', 'Geek'] },
  { label: 'Body', tags: ['Slim', 'Athletic', 'Muscular', 'Stocky', 'Chubby', 'Hairy', 'Smooth', 'Tatted'] },
  { label: 'Looking for', tags: ['NSA', 'Hookup', 'Casual', 'Dating', 'FWB', 'Discreet', 'Hosting', 'Can Travel', 'Right Now'] },
  { label: 'Vibe', tags: ['Kinky', 'Vanilla', 'Open', 'Sober', 'PnP-Free', 'Verified Only'] },
];

interface ProfileData {
  id: string;
  name: string;
  age: number;
  bio?: string;
  headline?: string;
  looking_for?: string;
  photo_url?: string;
  cover_url?: string;
  cover_position_x?: number;
  cover_position_y?: number;
  cover_zoom?: number;
  interests?: string[];
  lat?: number;
  lng?: number;
  online?: boolean;
  last_seen?: string;
  is_visible?: boolean;
  is_premium?: boolean;
  available_until?: string | null;
  created_at?: string;
}

type Toast = { type: 'success' | 'error'; msg: string };

export const Profile = () => {
  const { user, token, setAuth, patchUser, logout } = useAuthStore();
  const { lat, lng, setLocation } = useLocationStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [bio, setBio] = useState('');
  const [headline, setHeadline] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverFrame, setCoverFrame] = useState<CoverFrame>(DEFAULT_COVER_FRAME);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [mood, setMood] = useState<Mood | null>(null);
  const [isGhost, setIsGhost] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [profileViewers, setProfileViewers] = useState<ProfileViewer[]>([]);
  const [profileViewsTotal, setProfileViewsTotal] = useState(0);
  const [profileViewsHasMore, setProfileViewsHasMore] = useState(false);
  const [profileViewsHidden, setProfileViewsHidden] = useState(0);
  const [profileViewsLoading, setProfileViewsLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfileLoadError(null);
    usersAPI
      .getMe()
      .then((r) => {
        const d: ProfileData & { mood?: Mood | null; is_ghost?: boolean } = r.data;
        setProfile(d);
        setBio(d.bio ?? '');
        setHeadline(d.headline ?? '');
        setLookingFor(d.looking_for ?? '');
        setPhotoUrl(d.photo_url ?? '');
        setCoverUrl(d.cover_url ?? '');
        setCoverFrame(
          normalizeCoverFrame(d.cover_position_x, d.cover_position_y, d.cover_zoom),
        );
        setInterests(d.interests ?? []);
        if (typeof d.is_visible === 'boolean') setIsVisible(d.is_visible);
        if (d.mood !== undefined) setMood(d.mood ?? null);
        if (typeof d.is_ghost === 'boolean') setIsGhost(d.is_ghost);
        patchUser({ name: d.name, photo_url: d.photo_url ?? undefined });
      })
      .catch((err) => {
        setProfileLoadError(err?.response?.data?.error || 'Could not load your profile.');
      });
  }, []);

  useEffect(() => {
    setProfileViewsLoading(true);
    usersAPI
      .getProfileViews()
      .then((res) => {
        setProfileViewers(res.data.viewers ?? []);
        setProfileViewsTotal(res.data.total ?? 0);
        setProfileViewsHasMore(Boolean(res.data.has_more));
        setProfileViewsHidden(res.data.hidden_count ?? 0);
      })
      .catch(() => {
        setProfileViewers([]);
        setProfileViewsTotal(0);
        setProfileViewsHasMore(false);
        setProfileViewsHidden(0);
      })
      .finally(() => setProfileViewsLoading(false));
  }, []);

  const handleMood = async (next: Mood | null) => {
    const previous = mood;
    setMood(next);
    try {
      await profileMetaAPI.setMood(next);
      showToast('success', next ? 'Mood updated' : 'Mood cleared');
    } catch {
      setMood(previous);
      showToast('error', 'Could not update mood.');
    }
  };

  const handleGhost = async (next: boolean) => {
    if (next && !profile?.is_premium) {
      navigate('/premium');
      return;
    }
    const previous = isGhost;
    setIsGhost(next);
    try {
      await profileMetaAPI.setGhost(next);
      showToast('success', next ? 'Ghost mode on — you are invisible to others.' : 'Ghost mode off.');
    } catch (err: unknown) {
      setIsGhost(previous);
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (code === 'premium_required') {
        navigate('/premium');
        return;
      }
      showToast('error', 'Could not toggle ghost mode.');
    }
  };

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
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = '';

    const { file, error } = normalizeProfileImageFile(raw);
    if (!file) {
      showToast('error', error || 'Upload failed');
      return;
    }

    setUploading(true);
    try {
      const res = await usersAPI.uploadPhoto(file);
      setPhotoUrl(res.data.photo_url);
      setProfile((p) => p ? { ...p, photo_url: res.data.photo_url } : p);
      if (user && token) {
        patchUser({ photo_url: res.data.photo_url });
      }
      showToast('success', 'Photo uploaded');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = '';

    const { file, error } = normalizeProfileImageFile(raw);
    if (!file) {
      showToast('error', error || 'Cover upload failed');
      return;
    }

    setUploadingCover(true);
    try {
      const res = await usersAPI.uploadCover(file);
      setCoverUrl(res.data.cover_url);
      setCoverFrame(DEFAULT_COVER_FRAME);
      setProfile((p) =>
        p
          ? {
              ...p,
              cover_url: res.data.cover_url,
              cover_position_x: 50,
              cover_position_y: 50,
              cover_zoom: 1,
            }
          : p,
      );
      setCoverEditorOpen(true);
      showToast('success', 'Cover uploaded — adjust framing');
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Cover upload failed');
    } finally {
      setUploadingCover(false);
    }
  };

  const saveCoverFrame = async (frame: CoverFrame) => {
    try {
      const res = await usersAPI.updateProfile({
        cover_position_x: frame.x,
        cover_position_y: frame.y,
        cover_zoom: frame.zoom,
      });
      setCoverFrame(frame);
      setProfile((p) => (p ? { ...p, ...res.data } : p));
      setCoverEditorOpen(false);
      showToast('success', 'Cover framing saved');
    } catch {
      showToast('error', 'Could not save cover framing');
      throw new Error('cover_frame_save_failed');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await usersAPI.updateProfile({ bio, headline, looking_for: lookingFor, photo_url: photoUrl || undefined, interests });
      setProfile((p) => p ? { ...p, ...res.data } : p);
      if (user && token) setAuth({ ...user, bio, photo_url: photoUrl || undefined }, token);
      showToast('success', 'Profile saved');
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
          showToast('success', 'Location updated');
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
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
          {profileLoadError ? (
            <>
              <p className="text-[#F0E0C0]/80 text-sm">{profileLoadError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-[#C4832A]/10 hover:bg-[#C4832A]/20 text-[#C4832A] text-xs font-semibold border border-[#C4832A]/30"
              >
                Try again
              </button>
            </>
          ) : (
            <PulseRing size={32} label="Loading profile" />
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="sr-only">Your MenRush profile</h1>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-[calc(var(--mobile-header-height)+0.5rem)] left-1/2 z-50 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-card border animate-slide-up lg:top-6 ${
            toast.type === 'success'
              ? 'bg-nn-online/15 border-nn-online/25 text-[#8FC773]'
              : 'bg-[#8B4513]/15 border-[#8B4513]/25 text-[#F0E0C0]/80'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-xl space-y-4 px-4 py-4 pb-28 lg:max-w-6xl lg:space-y-8 lg:px-8 lg:py-8 lg:pb-12">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
          id="photo-upload"
          disabled={uploading}
        />

        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={handleCoverUpload}
          className="hidden"
          disabled={uploadingCover}
        />

        {/* ── Desktop profile layout ── */}
        <div className="hidden lg:grid lg:grid-cols-[300px_1fr] lg:gap-8">
          <div>
            <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-2xl border border-[#3D2B0E] bg-[#1E1508]">
              {getPhotoUrl(photoUrl) ? (
                <img src={getPhotoUrl(photoUrl)!} alt={profile.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <UserAvatar name={profile.name} photoUrl={profile.photo_url} size="xl" showStatus={false} />
                </div>
              )}
            </div>
            <div className="mt-3 grid max-w-[300px] grid-cols-3 gap-2">
              {[photoUrl, coverUrl, photoUrl].filter(Boolean).slice(0, 3).map((src, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl border border-[#3D2B0E] bg-[#1E1508]">
                  {getPhotoUrl(src) ? (
                    <img src={getPhotoUrl(src)!} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="mr-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-extrabold text-[var(--cream)]">{profile.name}</h2>
                {(profile as ProfileData & { is_verified?: boolean }).is_verified ? (
                  <VerifiedBadge />
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[var(--cream-muted)]">Age {profile.age}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {interests.slice(0, 4).map((tag) => (
                  <span key={tag} className="mr-pill mr-pill-inactive text-xs">
                    {tag}
                  </span>
                ))}
                {mood ? (
                  <span className="mr-pill mr-pill-active text-xs">{MOOD_LABELS[mood]}</span>
                ) : null}
              </div>
            </div>
            {user?.id ? (
              <div className="mr-card flex items-center gap-5 p-5">
                <div className="rounded-xl border border-[var(--border-default)] bg-white p-2">
                  <QRCodeSVG value={buildProfileUrl(user.id)} size={96} level="M" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[var(--cream)]">Your QR code</p>
                  <p className="mt-1 text-[13px] text-[var(--cream-muted)]">
                    Scan to open your profile in person.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="mr-card p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cream-muted)]">About</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--cream-soft)]">
                {bio || 'Add a bio so nearby guys know what you are into.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Profile hero (mobile) ── */}
        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl overflow-hidden shadow-card lg:hidden lg:rounded-3xl">
          <div className="group relative">
            {coverUrl ? (
              <CoverBanner coverUrl={coverUrl} frame={coverFrame} />
            ) : (
              <button
                type="button"
                aria-label="Upload cover photo"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className={`relative block h-40 sm:h-32 w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C4832A]/50 ${
                  uploadingCover ? 'pointer-events-none opacity-80' : ''
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#C4832A]/30 via-[#C4832A]/10 to-[#8B4513]/10" />
              </button>
            )}

            {coverUrl && (
              <div className="absolute inset-x-0 top-3 flex justify-center gap-2 px-3 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => setCoverEditorOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1E1508]/40 bg-[#0D0A06]/55 px-3 py-1.5 text-[11px] font-semibold text-[#F0E0C0] backdrop-blur-sm hover:border-[#C4832A]/40"
                >
                  Adjust cover
                </button>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1E1508]/40 bg-[#0D0A06]/55 px-3 py-1.5 text-[11px] font-semibold text-[#F0E0C0] backdrop-blur-sm hover:border-[#C4832A]/40 disabled:opacity-60"
                >
                  {uploadingCover ? 'Uploading…' : 'Change photo'}
                </button>
              </div>
            )}

            {!coverUrl && (
              <button
                type="button"
                aria-label="Upload cover photo"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="absolute inset-0 flex items-start justify-center pt-3"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1E1508]/40 bg-[#0D0A06]/55 px-3 py-1.5 text-[11px] font-semibold text-[#F0E0C0] backdrop-blur-sm">
                  {uploadingCover ? (
                    <>
                      <Spinner className="w-3.5 h-3.5" />
                      Uploading cover…
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3.5 h-3.5" />
                      Add cover photo
                    </>
                  )}
                </span>
              </button>
            )}

            {coverUrl && (
              <button
                type="button"
                aria-label="Change cover photo"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1E1508] bg-[#C4832A] text-[#0D0A06] shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
              >
                {uploadingCover ? (
                  <Spinner className="w-4 h-4 text-[#0D0A06]" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
          {/* Avatar overlapping cover */}
          <div className="px-5 pb-5">
            <p className="pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A89070] sm:hidden">
              Tap Adjust cover to move or zoom your banner
            </p>
            <div className="-mt-10 mb-3 flex items-end justify-between">
              <div className="relative">
                <button
                  type="button"
                  aria-label="Upload profile photo"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className={`group relative block cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4832A]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E1508] ${
                    uploading ? 'pointer-events-none opacity-70' : ''
                  }`}
                >
                  <UserAvatar
                    name={profile.name}
                    photoUrl={profile.photo_url}
                    online={profile.online}
                    size="xl"
                    showStatus={false}
                    className="ring-4 ring-[#1E1508] transition-opacity group-hover:opacity-90 group-active:opacity-80"
                  />
                  <span className="absolute inset-0 rounded-full bg-black/0 transition-colors group-hover:bg-black/20 group-active:bg-black/30" />
                  <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1E1508] bg-[#C4832A] text-[#0D0A06] shadow-lg transition-transform group-hover:scale-105 group-active:scale-95">
                    {uploading ? (
                      <Spinner className="w-4 h-4 text-[#0D0A06]" />
                    ) : (
                      <CameraIcon className="w-4 h-4" />
                    )}
                  </span>
                </button>
              </div>
              <StatusBadge online={!!profile.online} lastSeen={profile.last_seen} />
            </div>
            <h2 className="text-xl font-bold text-[#F0E0C0]">{profile.name}</h2>
            <p className="text-[#A89070] text-sm mt-0.5">Age {profile.age}</p>
          </div>
        </div>

        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          {/* ── Left: Edit profile ── */}
          <div className="space-y-4">
        {/* ── Edit form ── */}
        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl p-5 shadow-card lg:rounded-3xl">
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
              <div className="flex gap-4 items-center">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C4832A]/10 hover:bg-[#C4832A]/20 text-[#C4832A] text-xs font-semibold border border-[#C4832A]/30 cursor-pointer transition-all ${
                    uploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploading ? (
                    <Spinner className="w-4 h-4 text-[#C4832A]" />
                  ) : (
                    <UploadIcon className="w-4 h-4" />
                  )}
                  {uploading ? 'Uploading…' : 'Upload Photo'}
                </button>
                {photoUrl && !uploading && (
                  <span className="text-[10px] text-[#A89070]/70">Current photo set</span>
                )}
              </div>
              <p className="text-[10px] text-[#A89070]/60 mt-1.5 px-1">
                JPEG, PNG or WebP. Max 5MB.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-medium text-[#A89070] uppercase tracking-wide">
                Your tags <span className="normal-case text-[#A89070]/50">({interests.length}/10)</span>
              </label>
              {INTEREST_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-black text-[#A89070]/60 uppercase tracking-[.18em] mb-2">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((tag) => {
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
              ))}
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

          {/* ── Right: Settings & privacy ── */}
          <div className="space-y-4 lg:sticky lg:top-6">
            <div className="hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/40 px-4 py-3 lg:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)]">
                Account settings
              </p>
              <p className="mt-1 text-sm text-[var(--cream-soft)]">
                Privacy, visibility, and how you show up nearby.
              </p>
            </div>

        <ProfileViewersCard
          viewers={profileViewers}
          total={profileViewsTotal}
          isPremium={Boolean(profile.is_premium)}
          hasMore={profileViewsHasMore}
          hiddenCount={profileViewsHidden}
          loading={profileViewsLoading}
        />

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

        {/* ── Mood card ── */}
        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl p-5 shadow-card">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[#F0E0C0]/80 text-sm font-semibold">Mood</p>
              <p className="text-[#A89070] text-xs mt-0.5">
                Auto-clears in 6 hours. Shows on your card.
              </p>
            </div>
            {mood && (
              <button
                onClick={() => handleMood(null)}
                className="text-[10px] font-bold uppercase tracking-wider text-[#A89070] hover:text-[#C4832A] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <MoodPicker current={mood} onSelect={handleMood} />
        </div>

        {/* ── Ghost mode card ── */}
        <GhostToggle
          isGhost={isGhost}
          isPremium={Boolean(profile?.is_premium)}
          onToggle={handleGhost}
        />

        {/* ── Albums card ── */}
        <Link
          to="/albums"
          className="block rounded-2xl p-5 shadow-card border transition-colors hover:border-[var(--copper)]"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--cream)' }}>
                <PhotoStackIcon className="w-4 h-4" style={{ color: 'var(--copper)' }} />
                Private albums
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--cream-muted)' }}>
                6 free photos. Grant per profile. Unlimited on Premium.
              </p>
            </div>
            <span className="text-[var(--copper)] text-lg" aria-hidden>›</span>
          </div>
        </Link>

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
          </div>
        </div>

        {/* ── Sign out (mobile only — desktop uses sidebar) ── */}
        <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl p-5 shadow-card lg:hidden">
          <p className="text-[#F0E0C0]/80 text-sm font-semibold">Sign out</p>
          <p className="text-[#A89070] text-xs mt-0.5">You'll need to log back in</p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="mt-4 flex w-full items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#8B4513]/10 hover:bg-[#8B4513]/20 text-[#F0E0C0]/80 text-xs font-semibold border border-[#8B4513]/20 transition-all"
          >
            <LogoutIcon className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>

      {coverEditorOpen && coverUrl && (
        <CoverPhotoEditor
          coverUrl={coverUrl}
          initialFrame={coverFrame}
          onSave={saveCoverFrame}
          onCancel={() => setCoverEditorOpen(false)}
        />
      )}
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

const PhotoStackIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2zM8 4h12a2 2 0 012 2v10" />
  </svg>
);

const UploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
  </svg>
);

const CameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ImageIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

// Local Spinner shim — wraps PulseRing so existing className w-N h-N callers still work.
// PulseRing reads its size prop in pixels; Tailwind w-3.5/h-3.5 ≈ 14px, w-4 ≈ 16px, w-8 ≈ 32px.
const Spinner = ({ className = '' }: { className?: string }) => {
  const m = className.match(/w-(\d+(?:\.\d+)?)/);
  const size = m ? Math.round(parseFloat(m[1]) * 4) : 16;
  return <PulseRing size={size} className={className} />;
};
