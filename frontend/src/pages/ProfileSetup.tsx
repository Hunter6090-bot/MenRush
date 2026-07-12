import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import {
  AUTH_BACKGROUNDS,
  PublicAuthHero,
  PublicAuthShell,
} from '../components/PublicAuthShell';
import { UserAvatar } from '../components/UserAvatar';
import { PulseRing } from '../components/PulseRing';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import {
  isGenericAvatarUrl,
  resolveGenericAvatarUrl,
  type PhotoChoice,
} from '../lib/genericAvatar';
import { normalizeProfileImageFile } from '../lib/imageUpload';
import { PROFILE_LOOKING_FOR_TAGS, PROFILE_TAG_GROUPS, toggleProfileInterest } from '../lib/profileTags';
import {
  clearProfileSetupSkip,
  PROFILE_SETUP_STEPS,
  skipProfileSetup,
} from '../lib/profileSetup';
import { consumePostAuthRedirect } from '../lib/profileLinks';
import {
  publicBackButtonClass,
  publicDarkSelectClass,
  publicErrorClass,
  publicInfoBoxClass,
  publicLabelClass,
  publicMutedCopyClass,
  publicPanelClass,
  publicPrimaryButtonClass,
  publicProgressFillClass,
  publicProgressTrackClass,
  publicSecondaryButtonClass,
} from '../lib/publicStyles';

type Step = 'welcome' | 'photo' | 'about' | 'looking' | 'tags' | 'live';

const STEP_ORDER: Step[] = ['welcome', 'photo', 'about', 'looking', 'tags', 'live'];

const INTRO_ITEMS = [
  'Add a real photo (or a shared avatar if you prefer)',
  'Write a short bio guys can read on the map',
  'Pick what you are looking for',
  'Tag position, tribe, body, ethnicity & vibe',
  'Turn on live location and go visible',
] as const;

export const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const setLocation = useLocationStore((s) => s.setLocation);

  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState('');
  const [photoChoice, setPhotoChoice] = useState<PhotoChoice | null>(null);
  const [userAge, setUserAge] = useState<number | undefined>(user?.age);
  const [bio, setBio] = useState('');
  const [headline, setHeadline] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progressSteps = STEP_ORDER.length - 1;
  const progressPct = step === 'welcome' ? 0 : Math.round((stepIndex / progressSteps) * 100);

  const tagGroups = useMemo(
    () => PROFILE_TAG_GROUPS.filter((g) => g.label !== 'Looking for'),
    [],
  );

  const genericPreviewUrl = useMemo(() => {
    if (photoChoice !== 'generic') return null;
    if (isGenericAvatarUrl(photoUrl)) return photoUrl;
    if (interests.length >= 1) {
      return resolveGenericAvatarUrl({ age: userAge, interests });
    }
    return null;
  }, [photoChoice, photoUrl, interests, userAge]);

  useEffect(() => {
    usersAPI
      .getMe()
      .then((res) => {
        const d = res.data;
        const nextPhoto = d.photo_url ?? '';
        const nextBio = d.bio ?? '';
        const nextLooking = d.looking_for ?? '';
        const nextInterests: string[] = d.interests ?? [];
        setPhotoUrl(nextPhoto);
        setUserAge(d.age ?? user?.age);
        if (nextPhoto) {
          setPhotoChoice(isGenericAvatarUrl(nextPhoto) ? 'generic' : 'upload');
        }
        setBio(nextBio);
        setHeadline(d.headline ?? '');
        setLookingFor(nextLooking);
        setInterests(nextInterests);

        // Resume at first incomplete step — skip welcome when avatar already set.
        if (!nextPhoto) setStep('photo');
        else if ((nextBio.trim().length ?? 0) < 20) setStep('about');
        else if (!nextLooking.trim()) setStep('looking');
        else if (nextInterests.length < 3) setStep('tags');
        else setStep('live');
      })
      .catch(() => setError('Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  const hero = useMemo((): { title: string; accent: string; copy: string } => {
    switch (step) {
      case 'welcome':
        return {
          title: 'Finish your',
          accent: 'profile.',
          copy: 'Verified members with complete profiles get more views on the map. This takes about two minutes.',
        };
      case 'photo':
        return {
          title: 'Your',
          accent: 'avatar.',
          copy: 'Upload a recent photo so guys know who they are talking to — recommended even if you are discreet. Prefer no photo? Pick a standard avatar instead; we match it from your age, body and look tags, and several members may share the same one.',
        };
      case 'about':
        return {
          title: 'Tell them',
          accent: 'about you.',
          copy: 'A short bio and one-line headline help people decide to tap your pin.',
        };
      case 'looking':
        return {
          title: 'What are you',
          accent: 'after?',
          copy: 'Pick the main thing you are open to right now. You can change this anytime in Profile.',
        };
      case 'tags':
        return {
          title: 'Add your',
          accent: 'tags.',
          copy: 'Choose at least three tags across position, tribe, body, vibe, and scene.',
        };
      case 'live':
        return {
          title: 'Go',
          accent: 'live.',
          copy: 'Location is on by default — you agreed at signup. Allow GPS so nearby guys can find you.',
        };
    }
  }, [step]);

  const persistProfile = async (patch: {
    bio?: string;
    headline?: string;
    looking_for?: string;
    interests?: string[];
    photo_url?: string;
  }) => {
    const res = await usersAPI.updateProfile(patch);
    if (patch.photo_url && user) {
      patchUser({ photo_url: patch.photo_url });
    }
    if (patch.bio && user) {
      patchUser({ bio: patch.bio });
    }
    return res.data;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    e.target.value = '';

    const { file, error: fileError } = normalizeProfileImageFile(raw);
    if (!file) {
      setError(fileError || 'Upload failed');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const res = await usersAPI.uploadPhoto(file);
      setPhotoUrl(res.data.photo_url);
      setPhotoChoice('upload');
      patchUser({ photo_url: res.data.photo_url });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const toggleInterest = (tag: string, group: (typeof tagGroups)[number]) => {
    setInterests((prev) => toggleProfileInterest(prev, tag, group));
  };

  const goNext = async () => {
    setError(null);

    if (step === 'welcome') {
      setStep('photo');
      return;
    }

    if (step === 'photo') {
      if (!photoUrl && photoChoice !== 'generic') {
        setError('Upload a photo or choose a generic avatar to continue.');
        return;
      }
      if (photoChoice === 'generic' && !photoUrl) {
        setSaving(true);
        try {
          const genericUrl = resolveGenericAvatarUrl({ age: userAge, interests });
          await persistProfile({ photo_url: genericUrl });
          setPhotoUrl(genericUrl);
        } catch {
          setError('Could not save your avatar.');
          return;
        } finally {
          setSaving(false);
        }
      }
      setStep('about');
      return;
    }

    if (step === 'about') {
      if (bio.trim().length < 20) {
        setError('Write at least 20 characters in your bio.');
        return;
      }
      setSaving(true);
      try {
        await persistProfile({ bio: bio.trim(), headline: headline.trim() || undefined });
        setStep('looking');
      } catch {
        setError('Could not save your bio.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 'looking') {
      if (!lookingFor) {
        setError('Pick what you are looking for.');
        return;
      }
      setSaving(true);
      try {
        await persistProfile({ looking_for: lookingFor });
        setStep('tags');
      } catch {
        setError('Could not save your preference.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 'tags') {
      if (interests.length < 3) {
        setError('Pick at least three tags.');
        return;
      }
      setSaving(true);
      try {
        const patch: {
          interests: string[];
          photo_url?: string;
        } = { interests };

        if (photoChoice === 'generic') {
          const genericUrl = resolveGenericAvatarUrl({ age: userAge, interests });
          patch.photo_url = genericUrl;
          setPhotoUrl(genericUrl);
          patchUser({ photo_url: genericUrl });
        }

        await persistProfile(patch);
        setStep('live');
      } catch {
        setError('Could not save your tags.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 'live') {
      setSaving(true);
      setError(null);
      try {
        setLocating(true);
        const { requestDeviceLocation } = await import('../lib/deviceLocation');
        const result = await requestDeviceLocation();
        if (!result.ok) {
          setError(
            `${result.message} Location is required to go live on Nearby — MenRush is proximity-first (18+).`,
          );
          return;
        }
        try {
          await usersAPI.updateLocation(result.lat, result.lng);
          setLocation(result.lat, result.lng);
        } catch {
          setError('Got your position but could not save it. Check your connection and try again.');
          return;
        }

        clearProfileSetupSkip();
        navigate(consumePostAuthRedirect('/discover'));
      } finally {
        setSaving(false);
        setLocating(false);
      }
    }
  };

  const goBack = () => {
    setError(null);
    if (stepIndex <= 0) return;
    setStep(STEP_ORDER[stepIndex - 1]);
  };

  const handleSkip = () => {
    // Hollow profiles kill discovery quality. Bio + looking + tags required (avatar gated earlier).
    if (!photoUrl && photoChoice !== 'generic') {
      setError('Add a photo or generic avatar first.');
      return;
    }
    if (bio.trim().length < 20) {
      setError('Write at least 20 characters in your bio — men need a reason to tap you.');
      return;
    }
    if (!lookingFor.trim() || interests.length < 3) {
      setError('Pick what you want and at least 3 tags before skipping ahead.');
      return;
    }
    skipProfileSetup();
    navigate(consumePostAuthRedirect('/discover'));
  };

  if (loading) {
    return (
      <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.register} homeTo="/discover">
        <div className="flex justify-center py-24">
          <PulseRing size={40} label="Loading profile" />
        </div>
      </PublicAuthShell>
    );
  }

  return (
    <PublicAuthShell backgroundImage={AUTH_BACKGROUNDS.register} homeTo="/discover">
      <PublicAuthHero title={hero.title} accent={hero.accent} copy={hero.copy} />

      {step !== 'welcome' ? (
        <div className="mb-4">
          <div className={publicProgressTrackClass}>
            <div className={publicProgressFillClass} style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#A89070]">
            Step {stepIndex} of {progressSteps}
          </p>
        </div>
      ) : null}

      <div className={publicPanelClass}>
        {step === 'welcome' ? (
          <div className={publicInfoBoxClass}>
            {INTRO_ITEMS.map((item, i) => (
              <SetupChecklistItem key={item} n={String(i + 1)} text={item} />
            ))}
          </div>
        ) : null}

        {step === 'photo' ? (
          <div className="flex flex-col gap-4">
            <div className={publicInfoBoxClass}>
              <p className="text-[13px] leading-relaxed text-[#A89070]">
                <span className="font-semibold text-[#F0E0C0]">Discreet?</span> A clear photo
                still helps matches recognise you in chat — but it is your call. No photo means a
                standard avatar picked from your profile tags; only a few variants exist so you may
                look like other guys nearby.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />

              {photoChoice === 'generic' && !photoUrl && !genericPreviewUrl ? (
                <SilhouetteAvatar size={96} variant="card" className="ring-4 ring-[rgba(240,224,192,0.2)]" />
              ) : photoChoice === 'generic' ? (
                <UserAvatar
                  name={user?.name ?? 'You'}
                  photoUrl={(genericPreviewUrl || photoUrl) ?? undefined}
                  size="xl"
                  showStatus={false}
                  className="ring-4 ring-[rgba(240,224,192,0.2)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C4832A]/50"
                >
                  <UserAvatar
                    name={user?.name ?? 'You'}
                    photoUrl={photoUrl || undefined}
                    size="xl"
                    showStatus={false}
                    className="ring-4 ring-[rgba(240,224,192,0.2)]"
                  />
                  <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1E1508] bg-[#C4832A] text-[#1A0E03]">
                    {uploading ? <PulseRing size={16} /> : '+'}
                  </span>
                </button>
              )}

              <p className={publicMutedCopyClass}>
                {photoChoice === 'generic'
                  ? 'Shared avatar for now — real photos rank first nearby and get more matches.'
                  : 'Clear face or upper body · JPEG, PNG or WebP · max 5MB · 18+ only'}
              </p>
              {photoChoice === 'generic' ? (
                <p
                  className="mt-2 rounded-xl border border-[rgba(196,131,42,0.4)] bg-[rgba(196,131,42,0.1)] px-3 py-2 text-[12px] leading-relaxed text-[#E0A14A]"
                  data-testid="setup-generic-warning"
                >
                  Men match real photos first. You can upload anytime from Profile.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <button
                type="button"
                onClick={() => {
                  setPhotoChoice('upload');
                  photoInputRef.current?.click();
                }}
                disabled={uploading}
                className={`${publicPrimaryButtonClass} sm:flex-[1.4]`}
              >
                {uploading ? (
                  <>
                    <PulseRing size={18} /> Uploading…
                  </>
                ) : (
                  'Upload real photo'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhotoChoice('generic');
                  const preview = resolveGenericAvatarUrl({ age: userAge, interests });
                  setPhotoUrl(isGenericAvatarUrl(photoUrl) ? photoUrl : preview);
                  setError(null);
                }}
                className={`${publicSecondaryButtonClass} sm:flex-1 text-[12px] ${
                  photoChoice === 'generic'
                    ? 'border-[#C4832A] bg-[rgba(196,131,42,0.15)] text-[#E0A14A]'
                    : 'opacity-90'
                }`}
              >
                Use shared avatar
              </button>
            </div>
          </div>
        ) : null}

        {step === 'about' ? (
          <div className="space-y-4">
            <div>
              <label className={publicLabelClass} htmlFor="setup-bio">
                Bio
              </label>
              <textarea
                id="setup-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="What are you into? What should someone know before they message you?"
                className={`${publicDarkSelectClass} mt-2 min-h-[120px] resize-none rounded-2xl`}
              />
              <p className="mt-1 text-right text-[11px] text-[#A89070]">{bio.length}/500 · min 20</p>
            </div>
            <div>
              <label className={publicLabelClass} htmlFor="setup-headline">
                Headline <span className="font-normal normal-case text-[#A89070]">(optional)</span>
              </label>
              <input
                id="setup-headline"
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={100}
                placeholder="One line — e.g. Hosting tonight in Shoreditch"
                className={`${publicDarkSelectClass} mt-2`}
              />
            </div>
          </div>
        ) : null}

        {step === 'looking' ? (
          <div className="flex flex-wrap gap-2">
            {PROFILE_LOOKING_FOR_TAGS.map((tag) => {
              const active = lookingFor === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setLookingFor(tag)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
                    active
                      ? 'border-[#C4832A] bg-[rgba(196,131,42,0.2)] text-[#E0A14A]'
                      : 'border-[rgba(240,224,192,0.2)] bg-[rgba(13,10,6,0.35)] text-[#A89070] hover:border-[rgba(196,131,42,0.4)]'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 'tags' ? (
          <div className="max-h-[min(52vh,420px)] space-y-4 overflow-y-auto pr-1">
            <p className="text-[12px] text-[#A89070]">
              Selected {interests.length}/10
            </p>
            {tagGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#A89070]/70">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.tags.map((tag) => {
                    const active = interests.includes(tag);
                    const maxed = interests.length >= 10 && !active;
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={maxed}
                        onClick={() => toggleInterest(tag, group)}
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                          active
                            ? 'border-[#C4832A] bg-[rgba(196,131,42,0.2)] text-[#E0A14A]'
                            : maxed
                              ? 'cursor-not-allowed border-[rgba(240,224,192,0.1)] text-[#A89070]/30'
                              : 'border-[rgba(240,224,192,0.2)] bg-[rgba(13,10,6,0.35)] text-[#A89070] hover:border-[rgba(196,131,42,0.35)]'
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
        ) : null}

        {step === 'live' ? (
          <div className={publicInfoBoxClass}>
            {PROFILE_SETUP_STEPS.map((item) => (
              <SetupChecklistItem key={item.id} n="✓" text={item.label} done />
            ))}
            <p className="pt-2 text-[13px] leading-relaxed text-[#A89070]">
              Location unlocks Nearby. Tap finish and allow precise location — we never invent a city
              pin. Shared only while you use the app. 18+ only.
            </p>
          </div>
        ) : null}

        {error ? <p className={publicErrorClass}>{error}</p> : null}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void goNext()}
            disabled={saving || uploading || locating}
            className={publicPrimaryButtonClass}
          >
            {saving || locating ? (
              <>
                <PulseRing size={18} />
                {locating ? 'Getting location…' : 'Saving…'}
              </>
            ) : step === 'live' ? (
              'Enable location & go live'
            ) : step === 'welcome' ? (
              'Start setup'
            ) : (
              'Continue'
            )}
          </button>

          {step !== 'welcome' && step !== 'live' ? (
            <button type="button" onClick={goBack} className={publicBackButtonClass}>
              Back
            </button>
          ) : null}

          {step === 'live' ? (
            <button type="button" onClick={handleSkip} className={publicSecondaryButtonClass}>
              Open Discover without location
            </button>
          ) : null}
        </div>

        <p className={publicMutedCopyClass}>
          You can edit everything later on{' '}
          <Link to="/profile" className="font-bold text-[#C4832A] hover:text-[#E0A14A]">
            Profile
          </Link>
          .
        </p>
      </div>
    </PublicAuthShell>
  );
};

function SetupChecklistItem({
  n,
  text,
  done,
}: {
  n: string;
  text: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done
            ? 'bg-[#C4832A] text-[#1A0E03]'
            : 'border border-[rgba(240,224,192,0.25)] bg-[rgba(13,10,6,0.35)] text-[#E0A14A]'
        }`}
      >
        {n}
      </span>
      <span className={`text-[13.5px] ${done ? 'font-semibold text-[#F0E0C0]' : 'text-[#A89070]'}`}>
        {text}
      </span>
    </div>
  );
}

export default ProfileSetup;