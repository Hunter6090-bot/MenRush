import { FadedBrandFace, type FadedBrandFaceVariant } from './FadedBrandFace';
import { useResolvingPhotoSrc, type ResolvingPhotoOptions } from './UserAvatar';

export interface BrandAvatarProps {
  /** Stored photo path (`/uploads/...`, signed URL, blob). Empty / legacy → Brand face. */
  photoUrl?: string | null;
  /** Accessible name for the face (display name). */
  name?: string;
  /** Classes for the real <img> (sizing comes from the parent container by default). */
  imgClassName?: string;
  /** Extra classes on the Brand placeholder wrapper. */
  placeholderClassName?: string;
  /** `profile` = circle face zoom (default), `tile` = square grid crop, `pin` = whole medallion. */
  variant?: FadedBrandFaceVariant;
  /** Optional explicit pixel size for the placeholder. */
  size?: number;
  /** `alt` for real photos (defaults to empty — decorative next to a name). */
  alt?: string;
  resolveOptions?: ResolvingPhotoOptions;
  'data-testid'?: string;
}

/**
 * The ONE avatar renderer for surfaces that draw their own frame (room rails,
 * video tiles, chat bubbles, cards): real photo if it loads, else the
 * Brand-signed faded medallion cutout. Never initials / silhouette / generic SVG.
 * Fills its parent — the parent owns size, ring and border-radius.
 */
export function BrandAvatar({
  photoUrl,
  name,
  imgClassName = 'h-full w-full object-cover',
  placeholderClassName = '',
  variant = 'profile',
  size,
  alt = '',
  resolveOptions,
  'data-testid': testId,
}: BrandAvatarProps) {
  const { src, onError } = useResolvingPhotoSrc(photoUrl, undefined, resolveOptions);
  if (!src) {
    return (
      <FadedBrandFace
        variant={variant}
        size={size}
        label={name || 'MenRush'}
        className={placeholderClassName}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={onError}
      draggable={false}
      className={imgClassName}
      data-testid={testId}
    />
  );
}
