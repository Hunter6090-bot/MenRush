import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ComingSoon } from './ComingSoon';

vi.mock('../observability/analytics', () => ({
  trackEventOnce: vi.fn(),
  getAttributionParams: () => ({}),
}));

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ComingSoon />
    </MemoryRouter>,
  );
}

describe('ComingSoon homepage', () => {
  it('has no Back to signup link', () => {
    renderHome();
    expect(screen.queryByText(/back to sign ?up/i)).not.toBeInTheDocument();
  });

  it('keeps the invite line out of the hero but /invite still reachable', () => {
    renderHome();
    const hero = screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement;
    expect(hero).not.toBeNull();
    expect(within(hero).queryByText(/already have an invite/i)).not.toBeInTheDocument();
    expect(within(hero).queryByRole('link', { name: /code/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/already have an invite/i)).not.toBeInTheDocument();
    const codeLink = screen.getByRole('link', { name: 'Have a code?' });
    expect(codeLink).toHaveAttribute('href', '/invite');
  });

  it('lists what the app does now: map, chat, Rooms (Premium only) and Out', () => {
    renderHome();
    const list = screen.getByRole('region', { name: /what you get/i });
    for (const title of ['Map', 'Chat', 'Rooms', 'Out']) {
      expect(within(list).getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
    }
    expect(within(list).getByText(/premium only/i)).toBeInTheDocument();
    expect(within(list).getByText('Cruising spots, hot spots and events.')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  });

  it('makes no claims the app cannot keep', () => {
    const { container } = renderHome();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/verified profiles/i);
    expect(text).not.toMatch(/total discretion/i);
    expect(text).not.toMatch(/live proximity|right now|no swiping/i);
    expect(text).not.toMatch(/meet is real/i);
    expect(text).not.toMatch(/\b(date|dating|drinks|friends|romantic|coffee)\b/i);
    expect(text).not.toContain('\u2014');
  });

  it('shows no beta text or beta links', () => {
    const { container } = renderHome();
    expect(container.textContent ?? '').not.toMatch(/beta/i);
    expect(container.innerHTML).not.toMatch(/href="[^"]*\/beta/i);
  });

  it('keeps the sign-up and sign-in routes', () => {
    renderHome();
    expect(screen.getByRole('link', { name: 'Sign up free' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
