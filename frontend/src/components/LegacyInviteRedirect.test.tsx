import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LegacyInviteRedirect } from './LegacyInviteRedirect';
import { ComingSoon } from '../pages/ComingSoon';

vi.mock('../observability/analytics', () => ({
  trackEventOnce: vi.fn(),
  getAttributionParams: () => ({}),
}));

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={['/start', entry]} initialIndex={1}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Where />
              <ComingSoon />
            </>
          }
        />
        <Route path="/beta" element={<LegacyInviteRedirect />} />
        <Route path="/invite" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LegacyInviteRedirect', () => {
  it('sends the old preview address home and shows no beta text', async () => {
    const { container } = renderAt('/beta');
    expect((await screen.findByTestId('where')).textContent).toBe('/');
    expect(screen.getByText(/Already have an invite\?/)).toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/beta/i);
    expect(container.innerHTML).not.toMatch(/href="[^"]*\/beta/i);
  });

  it('keeps an optional invite code from an old email', () => {
    renderAt('/beta?invite=MENRUSH-ABCD');
    expect(screen.getByTestId('where').textContent).toBe('/invite?invite=MENRUSH-ABCD');
  });
});
