import { FadedBrandFace, isNearbyPlaceholderFace } from './FadedBrandFace';

const BUBBLE_AVATAR_PX = 28;

/**
 * 1:1 chat bubble face — empty/missing/generic → faded cutout (never gold stub).
 * Real /uploads photos keep their bytes (media lock).
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
        className="inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full"
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
      className="h-7 w-7 overflow-hidden rounded-full"
      style={{ border: '1px solid var(--border-default)', flexShrink: 0 }}
      data-testid={`chat-bubble-avatar-photo-${userId}`}
    >
      <img
        src={photoUrl!}
        alt={name ?? ''}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
