import React, { useId } from 'react';
import { roomIconKey, roomInitials, type RoomIconKey } from '../lib/roomIcons';
import bearsCubs from '../assets/room-icons/bears-cubs.svg?raw';
import daddies from '../assets/room-icons/daddies.svg?raw';
import discreetDl from '../assets/room-icons/discreet-dl.svg?raw';
import groupPlay from '../assets/room-icons/group-play.svg?raw';
import kinkPig from '../assets/room-icons/kink-pig.svg?raw';
import leatherGear from '../assets/room-icons/leather-gear.svg?raw';
import muscleJocks from '../assets/room-icons/muscle-jocks.svg?raw';
import smokersCigars from '../assets/room-icons/smokers-cigars.svg?raw';

/** Claude Design room icons: 24x24, stroke-only, currentColor, stroke-width 2. */
const ROOM_ICON_SVG: Record<RoomIconKey, string> = {
  'bears-cubs': bearsCubs,
  daddies,
  'discreet-dl': discreetDl,
  'group-play': groupPlay,
  'kink-pig': kinkPig,
  'leather-gear': leatherGear,
  'muscle-jocks': muscleJocks,
  'smokers-cigars': smokersCigars,
};

/**
 * Inline markup for one icon. Two icons use an SVG <mask>; its id is made
 * unique per instance so many cards on one screen never share (or lose) a
 * mask. The markup is our own static asset, never user input.
 */
function iconMarkup(key: RoomIconKey, uid: string): string {
  return ROOM_ICON_SVG[key]
    .replace(/id="([^"]+)"/g, `id="$1-${uid}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1-${uid})`)
    .replace('<svg ', '<svg aria-hidden="true" focusable="false" width="100%" height="100%" ');
}

export interface RoomAvatarProps {
  name: string | null | undefined;
  officialSlug?: string | null;
  /** Container size and shape, e.g. "h-14 w-14 rounded-2xl". */
  className?: string;
  /** Icon size inside the container, e.g. "h-7 w-7". */
  iconClassName?: string;
  /** Letter-square background / border (unchanged per call site). The icon
   *  tile is styled in globals.css (.room-avatar--icon) for light and dark. */
  letterStyle?: React.CSSProperties;
  /** Extra classes for the letter square text, e.g. "text-base font-bold". */
  letterClassName?: string;
  /** Shown instead of letters while the room is still loading. */
  placeholder?: string;
}

/**
 * Room tile: the matching Claude Design icon in copper, or the existing
 * letter square when no icon matches. Decorative either way; the room name is
 * always visible text next to it.
 */
export const RoomAvatar: React.FC<RoomAvatarProps> = ({
  name,
  officialSlug,
  className = 'h-12 w-12 rounded-2xl',
  iconClassName = 'h-6 w-6',
  letterStyle,
  letterClassName = 'text-base font-bold',
  placeholder,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const key = name || officialSlug ? roomIconKey({ name, official_slug: officialSlug }) : null;

  if (key) {
    return (
      <div
        className={`room-avatar room-avatar--icon flex flex-shrink-0 items-center justify-center ${className}`}
        data-room-icon={key}
        aria-hidden="true"
      >
        <span
          className={`room-avatar__icon block ${iconClassName}`}
          dangerouslySetInnerHTML={{ __html: iconMarkup(key, uid) }}
        />
      </div>
    );
  }

  return (
    <div
      className={`room-avatar room-avatar--letters flex flex-shrink-0 items-center justify-center ${letterClassName} ${className}`}
      style={{ color: '#C4832A', ...letterStyle }}
      data-room-icon="letters"
      aria-hidden="true"
    >
      {name ? roomInitials(name) : (placeholder ?? '')}
    </div>
  );
};
