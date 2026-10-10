import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  BROKEN_PHOTO_TTL_MS,
  isKnownBrokenPhotoSrc,
  markBrokenPhotoSrc,
  resetBrokenPhotoSrcs,
  UserAvatar,
} from './UserAvatar';

const CUTOUT = '/brand/medallion-transparent.png';
const BROKEN = '/uploads/t.jpg';

function renderAvatar(testId: string) {
  return render(
    <MemoryRouter>
      <UserAvatar name="Quiet Fox" photoUrl={BROKEN} data-testid={testId} />
    </MemoryRouter>,
  );
}

function photoImg(container: HTMLElement) {
  return Array.from(container.querySelectorAll('img')).find(
    (img) => !img.closest('[data-testid="faded-brand-face"]'),
  );
}

function failEveryCandidate(container: HTMLElement): string[] {
  const tried: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    const img = photoImg(container);
    if (!img) break;
    tried.push(img.getAttribute('src') ?? '');
    fireEvent.error(img);
  }
  return tried;
}

describe('UserAvatar broken photo memo', () => {
  beforeEach(() => resetBrokenPhotoSrcs());

  it('a 404 photo falls back to the Brand medallion cutout', () => {
    const { container } = renderAvatar('a');
    const tried = failEveryCandidate(container);
    expect(tried.length).toBeGreaterThan(0);
    expect(photoImg(container)).toBeUndefined();
    expect(
      screen.getByTestId('faded-brand-face').querySelector('img')?.getAttribute('src'),
    ).toBe(CUTOUT);
  });

  it('remounting after a 404 does not request the broken URL again', () => {
    const first = renderAvatar('first');
    failEveryCandidate(first.container);
    first.unmount();

    const second = renderAvatar('second');
    // No photo <img> at all: straight to the placeholder, so no network request.
    expect(photoImg(second.container)).toBeUndefined();
    expect(second.container.innerHTML).not.toContain(BROKEN);
    expect(
      second.container.querySelector('[data-testid="faded-brand-face"] img')?.getAttribute('src'),
    ).toBe(CUTOUT);
  });

  it('a remembered failure expires so a restored photo can load again', () => {
    const t0 = 1_000_000;
    markBrokenPhotoSrc('https://api.example.test/uploads/x.jpg', t0);
    expect(isKnownBrokenPhotoSrc('https://api.example.test/uploads/x.jpg', t0 + 1)).toBe(true);
    expect(
      isKnownBrokenPhotoSrc('https://api.example.test/uploads/x.jpg', t0 + BROKEN_PHOTO_TTL_MS + 1),
    ).toBe(false);
  });

  it('a working photo is never marked broken', () => {
    const { container } = render(
      <MemoryRouter>
        <UserAvatar name="Real" photoUrl="/uploads/profiles/real.jpg" />
      </MemoryRouter>,
    );
    const img = photoImg(container);
    expect(img?.getAttribute('src')).toContain('/uploads/profiles/real.jpg');
    expect(isKnownBrokenPhotoSrc(img!.getAttribute('src')!)).toBe(false);
  });
});
