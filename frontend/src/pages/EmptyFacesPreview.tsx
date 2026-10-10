import { useEffect } from 'react';
import { ProfileCard, type NearbyUser } from '../components/ProfileCard';
import { ChatBubbleFace } from '../components/ChatBubbleFace';
import { FadedBrandFace } from '../components/FadedBrandFace';
import { applyTheme } from '../lib/theme';

/**
 * DEV harness — leftover empty faces after #263 QC.
 * Route: /dev/empty-faces
 * Empty/missing only → faded `/brand/medallion-transparent.png`. Never gold stub.
 */
const EMPTY_CARD: NearbyUser = {
  id: 'empty-card',
  name: 'QuietOne',
  age: 31,
  online: true,
  distance_km: 0.8,
  distance_label: '0.5 mi',
  looking_for: 'Chat',
};

const PHOTO_CARD: NearbyUser = {
  id: 'photo-card',
  name: 'PhotoKeep',
  age: 34,
  online: false,
  distance_km: 2.1,
  distance_label: '1.3 mi',
  photo_url: '/images/menrush/30-bear-portrait-night.jpeg',
  looking_for: 'Friends',
};

export function EmptyFacesPreview() {
  useEffect(() => {
    applyTheme('dark');
  }, []);

  return (
    <div
      className="min-h-screen px-4 py-6"
      style={{ background: 'var(--bg-primary)', color: 'var(--cream)' }}
      data-testid="empty-faces-preview"
    >
      <p className="text-[12px] font-bold uppercase tracking-wide text-[#C4832A]">
        Empty faces preview
      </p>
      <p className="mt-1 mb-5 max-w-xl text-[12px] text-[var(--cream-muted)]">
        ProfileCard + chat bubble empties use FadedBrandFace cutout. Real photos stay.
      </p>

      <section className="mb-8" data-testid="empty-faces-profile-cards">
        <h2 className="mb-3 text-[13px] font-semibold text-[var(--cream)]">
          Discovery ProfileCard
        </h2>
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <ProfileCard user={EMPTY_CARD} />
          <ProfileCard user={PHOTO_CARD} />
        </div>
      </section>

      <section className="mb-8" data-testid="empty-faces-chat-bubbles">
        <h2 className="mb-3 text-[13px] font-semibold text-[var(--cream)]">
          Chat bubbles
        </h2>
        <div className="flex max-w-md flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
          <div className="flex items-end gap-2">
            <ChatBubbleFace userId="peer-empty" name="QuietPeer" />
            <div className="rounded-2xl rounded-bl-md bg-[var(--bg-elevated)] px-3 py-2 text-[13px]">
              Empty face → cutout
            </div>
          </div>
          <div className="flex items-end gap-2">
            <ChatBubbleFace
              userId="peer-photo"
              name="PhotoPeer"
              photoUrl="/images/menrush/30-bear-portrait-night.jpeg"
            />
            <div className="rounded-2xl rounded-bl-md bg-[var(--bg-elevated)] px-3 py-2 text-[13px]">
              Real photo kept
            </div>
          </div>
          <div className="flex items-end gap-2">
            <ChatBubbleFace
              userId="peer-generic"
              name="GenericPeer"
              photoUrl="/avatars/generic/02.svg"
            />
            <div className="rounded-2xl rounded-bl-md bg-[var(--bg-elevated)] px-3 py-2 text-[13px]">
              /avatars/* → cutout
            </div>
          </div>
        </div>
      </section>

      <section data-testid="empty-faces-reference">
        <h2 className="mb-3 text-[13px] font-semibold text-[var(--cream)]">
          Reference cutout (profile 72)
        </h2>
        <FadedBrandFace variant="profile" size={72} label="Reference" />
      </section>
    </div>
  );
}
