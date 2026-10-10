import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BrandAvatar } from './BrandAvatar';
import { UserAvatar } from './UserAvatar';

const CUTOUT = '/brand/medallion-transparent.png';

function cutoutSrc() {
  return screen.getByTestId('faded-brand-face').querySelector('img')?.getAttribute('src');
}

describe('BrandAvatar', () => {
  it('empty photo → Brand faded cutout', () => {
    render(<BrandAvatar name="Empty" />);
    expect(cutoutSrc()).toBe(CUTOUT);
  });

  it('legacy generic /avatars/* → Brand faded cutout, never the SVG', () => {
    const { container } = render(<BrandAvatar name="Gen" photoUrl="/avatars/generic/03.svg" />);
    expect(cutoutSrc()).toBe(CUTOUT);
    expect(container.innerHTML).not.toContain('/avatars/generic/');
  });

  it('real /uploads photo renders the photo (media lock)', () => {
    render(<BrandAvatar name="Real" photoUrl="/uploads/profiles/real.jpg" data-testid="real" />);
    expect(screen.queryByTestId('faded-brand-face')).toBeNull();
    expect(screen.getByTestId('real').getAttribute('src')).toContain('/uploads/profiles/real.jpg');
  });

  it('photo that fails every candidate → Brand cutout (no generic, no initials)', () => {
    const { container } = render(
      <BrandAvatar name="Broken" photoUrl="/uploads/profiles/gone.jpg" data-testid="broken" />,
    );
    // Walk all candidates until exhausted.
    for (let i = 0; i < 12; i += 1) {
      const img = screen.queryByTestId('broken');
      if (!img) break;
      fireEvent.error(img);
    }
    expect(cutoutSrc()).toBe(CUTOUT);
    expect(container.innerHTML).not.toContain('/avatars/generic/');
  });
});

describe('UserAvatar fallback', () => {
  it('no photo → Brand cutout, not an initial letter', () => {
    const { container } = render(
      <MemoryRouter>
        <UserAvatar name="Zed" />
      </MemoryRouter>,
    );
    expect(cutoutSrc()).toBe(CUTOUT);
    expect(container.textContent).not.toContain('Z');
  });

  it('generic avatar path → Brand cutout', () => {
    const { container } = render(
      <MemoryRouter>
        <UserAvatar name="Gen" photoUrl="/avatars/generic/09.svg" age={50} />
      </MemoryRouter>,
    );
    expect(cutoutSrc()).toBe(CUTOUT);
    expect(container.innerHTML).not.toContain('/avatars/generic/');
  });

  it('broken upload falls to Brand cutout, never age-based generic SVG', () => {
    const { container } = render(
      <MemoryRouter>
        <UserAvatar name="Old" photoUrl="/uploads/profiles/missing.jpg" age={50} />
      </MemoryRouter>,
    );
    for (let i = 0; i < 12; i += 1) {
      const img = container.querySelector('img[alt="Old"]');
      if (!img) break;
      fireEvent.error(img);
    }
    expect(cutoutSrc()).toBe(CUTOUT);
    expect(container.innerHTML).not.toContain('/avatars/generic/');
  });
});
