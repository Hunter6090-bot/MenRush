import { FadedBrandFace, isNearbyPlaceholderFace } from './FadedBrandFace';
import { BrandAvatar } from './BrandAvatar';

const BUBBLE_AVATAR_PX = 32;

/**
 * 1:1 chat bubble face — empty/missing/generic/failed → ONE Brand placeholder
 * (faded medallion cutout). Real /uploads photos keep their bytes (media lock).
 */
export function ChatBubbleFace({
  userId,
  name,
  photoUrl,
}: {
  userId: string;
  name?: string;
  photoUrl?: string | null;
}) {
  if (isNearbyPlaceholderFace(photoUrl)) {
    return (
      <span
        className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full"
        data-testid={`chat-bubble-avatar-empty-${userId}`}
      >
        <FadedBrandFace
          variant="profile"
          size={BUBBLE_AVATAR_PX}
          label={name ?? 'MenRush'}
        />
      </span>
    );
  }

  return (
    <div
      className="h-8 w-8 overflow-hidden rounded-full"
      style={{ border: '1px solid var(--border-default)', flexShrink: 0 }}
      data-testid={`chat-bubble-avatar-photo-${userId}`}
    >
      <BrandAvatar photoUrl={photoUrl} name={name} alt={name ?? ''} size={BUBBLE_AVATAR_PX} />
    </div>
  );
}
