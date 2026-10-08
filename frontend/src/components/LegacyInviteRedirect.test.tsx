import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LegacyInviteRedirect } from './LegacyInviteRedirect';

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

describe('LegacyInviteRedirect', () => {
  it('sends old /beta links to /invite and keeps the invite code', () => {
    render(
      <MemoryRouter initialEntries={['/beta?invite=MENRUSH-ABCD']}>
        <Routes>
          <Route path="/beta" element={<LegacyInviteRedirect />} />
          <Route path="/invite" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe('/invite?invite=MENRUSH-ABCD');
  });
});
