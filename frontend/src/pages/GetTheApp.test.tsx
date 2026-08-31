import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GetTheApp } from '../pages/GetTheApp';

const navigate = vi.fn();

vi.mock('../lib/push', () => ({
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('GetTheApp walkthrough', () => {
  beforeEach(() => {
    navigate.mockClear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
  });

  it('renders a real apostrophe on the last step, not a unicode escape', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GetTheApp />
      </MemoryRouter>,
    );

    // Advance through all 4 iPhone steps → done screen
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe("It's on your Home Screen.");
    expect(heading.textContent).not.toContain('\\u2019');
    expect(heading.textContent).not.toContain('u2019');
  });

  it('navigates to /login when Done is pressed on the last step', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GetTheApp />
      </MemoryRouter>,
    );

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(navigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
