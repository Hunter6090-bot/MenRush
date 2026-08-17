import React from 'react';
import { Link } from 'react-router-dom';
import { useProfilePhotoHref } from './UserAvatar';

interface ProfilePhotoLinkProps {
  userId: string;
  name?: string;
  className?: string;
  children: React.ReactNode;
  /** Stop parent click handlers (e.g. conversation row → messages). */
  stopPropagation?: boolean;
  'data-testid'?: string;
}

/**
 * Wraps any photo/face surface so taps follow the product rule:
 * self → /profile, someone else → /profile/:id.
 */
export function ProfilePhotoLink({
  userId,
  name,
  className = '',
  children,
  stopPropagation = false,
  'data-testid': testId = 'profile-photo-link',
}: ProfilePhotoLinkProps) {
  const href = useProfilePhotoHref(userId);
  if (!href) return <>{children}</>;

  return (
    <Link
      to={href}
      data-testid={testId}
      aria-label={name ? `Open ${name}'s profile` : 'Open profile'}
      className={className}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      {children}
    </Link>
  );
}
