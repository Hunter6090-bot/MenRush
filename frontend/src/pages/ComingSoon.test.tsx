import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ComingSoon } from './ComingSoon';
import { Landing } from './Landing';

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

  it('lists what the app does now: map, chat, Rooms (private groups need Premium) and Out', () => {
    renderHome();
    const list = screen.getByRole('region', { name: /what you get/i });
    for (const title of ['Map', 'Chat', 'Rooms', 'Out']) {
      expect(within(list).getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
    }
    expect(within(list).getByText('Group chats. Private groups need Premium.')).toBeInTheDocument();
    // Free members can self-join official and nearby rooms; only private groups need Premium.
    expect(within(list).queryByText(/premium only/i)).not.toBeInTheDocument();
    expect(within(list).getByText('Cruising spots, hot spots and events.')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows the overline in normal case, not all caps', () => {
    renderHome();
    expect(screen.getByText('Free to join')).toBeInTheDocument();
    expect(screen.queryByText(/LIVE NOW/i)).not.toBeInTheDocument();
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

/** Al's rule: every promise on a public landing must be strictly true. */
const UNTRUE_CLAIMS = [
  /verified profiles/i,
  /total discretion/i,
  /live proximity/i,
  /right now/i,
  /no swiping/i,
  /meet is real/i,
  /real-time presence/i,
  /LIVE NOW/i,
  /premium only/i,
];

function expectOnlyTrueClaims(text: string) {
  for (const claim of UNTRUE_CLAIMS) expect(text).not.toMatch(claim);
  expect(text).not.toMatch(/\b(date|dating|drinks|friends|romantic|coffee)\b/i);
  expect(text).not.toMatch(/beta/i);
  expect(text).not.toContain('\u2014');
}

describe('public landings make only true claims', () => {
  it('ComingSoon (the live homepage) renders no untrue claims', () => {
    const { container } = renderHome();
    expectOnlyTrueClaims(container.textContent ?? '');
  });

  it('Landing renders no untrue claims', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("See who's around.On the map.");
    expect(screen.getByText(/Rooms and Out\. Private groups need Premium\./)).toBeInTheDocument();
    expectOnlyTrueClaims(container.textContent ?? '');
  });

  it.each(['ComingSoon.tsx', 'Landing.tsx'])('%s source has no untrue claims', (file) => {
    const src = readFileSync(resolve(__dirname, file), 'utf8');
    for (const claim of UNTRUE_CLAIMS) expect(src).not.toMatch(claim);
  });
});
