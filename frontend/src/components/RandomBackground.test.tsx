import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { RandomBackground } from './RandomBackground';
import {
  MENRUSH_BACKGROUND_IMAGES,
  resetPageBackgroundPickForTests,
} from '../lib/menrushBackgrounds';

function NavButtons() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/login')}>
        to-login
      </button>
      <button type="button" onClick={() => navigate('/register')}>
        to-register
      </button>
    </>
  );
}

function bgUrl(): string {
  return screen.getByTestId('random-background').style.backgroundImage;
}

describe('RandomBackground', () => {
  afterEach(() => {
    cleanup();
    resetPageBackgroundPickForTests();
    vi.restoreAllMocks();
  });

  it('keeps the same photo while staying on one pathname (no timer tick)', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <RandomBackground />
      </MemoryRouter>,
    );

    const first = bgUrl();
    expect(setIntervalSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(bgUrl()).toBe(first);

    vi.useRealTimers();
  });

  it('re-rolls when pathname changes while the shell stays mounted', async () => {
    const user = userEvent.setup();

    // Always return 0 so each pick takes candidates[0] after excluding last.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <NavButtons />
        <RandomBackground />
        <Routes>
          <Route path="/login" element={<div>login</div>} />
          <Route path="/register" element={<div>register</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const first = bgUrl();
    expect(first).toContain('/images/menrush/');

    await user.click(screen.getByRole('button', { name: 'to-register' }));
    const second = bgUrl();
    expect(second).toContain('/images/menrush/');
    expect(second).not.toBe(first);

    // With random always 0 and avoid-last, first stable pick is [0] (Strict Mode
    // may remount once); next page must not equal the image left as lastPicked.
    expect(MENRUSH_BACKGROUND_IMAGES.some((src) => first.includes(src))).toBe(true);
    expect(MENRUSH_BACKGROUND_IMAGES.some((src) => second.includes(src))).toBe(true);
  });
});
