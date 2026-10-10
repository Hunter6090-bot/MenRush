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

  it('keeps tracking params going home', () => {
    renderAt('/beta?utm_source=x&ref=y');
    expect(screen.getByTestId('where').textContent).toBe('/?utm_source=x&ref=y');
  });

  it('keeps all utm params and ref, and drops unknown params', () => {
    renderAt(
      '/beta?utm_source=news&utm_medium=email&utm_campaign=oct&utm_content=hero&utm_term=sauna&ref=pete&session=abc&foo=1',
    );
    expect(screen.getByTestId('where').textContent).toBe(
      '/?utm_source=news&utm_medium=email&utm_campaign=oct&utm_content=hero&utm_term=sauna&ref=pete',
    );
  });

  it('drops an unknown param on its own and lands on / with no query', () => {
    renderAt('/beta?foo=1');
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('a plain visit lands on / with no query', () => {
    renderAt('/beta');
    expect(screen.getByTestId('where').textContent).toBe('/');
  });

  it('keeps tracking params alongside an invite code and drops unknown ones', () => {
    renderAt('/beta?utm_source=x&invite=MENRUSH-ABCD&foo=1&ref=y');
    expect(screen.getByTestId('where').textContent).toBe('/invite?invite=MENRUSH-ABCD&utm_source=x&ref=y');
  });

  it('keeps an optional invite code from an old email', () => {
    renderAt('/beta?invite=MENRUSH-ABCD');
    expect(screen.getByTestId('where').textContent).toBe('/invite?invite=MENRUSH-ABCD');
  });
});
