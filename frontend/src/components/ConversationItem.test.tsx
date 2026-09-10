import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConversationItem } from './ConversationItem';
import { BRAND_MEDALLION } from '../lib/brand';

vi.mock('../hooks/store', () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) =>
    sel({ user: { id: 'self' } }),
}));

vi.mock('./ChatSafetyMenu', () => ({
  ChatSafetyMenu: () => <button type="button" aria-label="More">...</button>,
}));

function renderItem(props: {
  userId?: string;
  name?: string;
  photoUrl?: string;
  online?: boolean;
  lastMessage?: string;
  variant?: 'default' | 'sidebar';
} = {}) {
  return render(
    <MemoryRouter>
      <ConversationItem
        userId={props.userId ?? 'u1'}
        name={props.name ?? 'Nick'}
        photoUrl={props.photoUrl}
        online={props.online}
        lastMessage={props.lastMessage ?? 'Hey'}
        variant={props.variant ?? 'sidebar'}
      />
    </MemoryRouter>,
  );
}

describe('ConversationItem avatars', () => {
  it('uses Brand faded face for empty / generic slots — no square ring', () => {
    const { container } = renderItem({
      name: 'Nick',
      photoUrl: undefined,
      online: true,
    });

    expect(screen.getByTestId('faded-brand-face')).toBeInTheDocument();
    const img = screen.getByTestId('faded-brand-face').querySelector('img');
    expect(img?.getAttribute('src')).toBe(BRAND_MEDALLION);

    // Former square chrome: ring on a non-rounded wrapper
    expect(container.querySelector('[class*="ring-2"]')).toBeNull();
  });

  it('keeps real /uploads photos (media lock) and drops square ring', () => {
    const { container } = renderItem({
      name: 'Bigbear25',
      photoUrl: '/uploads/profiles/real.jpg',
      online: false,
    });

    expect(screen.queryByTestId('faded-brand-face')).not.toBeInTheDocument();
    const photo = container.querySelector('img[alt="Bigbear25"]');
    expect(photo).not.toBeNull();
    expect(photo!.getAttribute('src')).toContain('/uploads/profiles/real.jpg');

    expect(container.querySelector('[class*="ring-2"]')).toBeNull();
    // Size override lands on the rounded wrapper (circle, not square frame)
    const sized = Array.from(container.querySelectorAll('.rounded-full')).find((el) =>
      el.className.includes('!w-[52px]'),
    );
    expect(sized).toBeTruthy();
  });

  it('treats /avatars/* generic silhouettes as Brand empty face', () => {
    renderItem({
      name: 'ChubbyBear',
      photoUrl: '/avatars/generic/03.svg',
    });
    expect(screen.getByTestId('faded-brand-face')).toBeInTheDocument();
  });
});
