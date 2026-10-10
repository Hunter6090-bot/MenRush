import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Login } from './Login';

vi.mock('../components/InstallPrompt', () => ({ InstallPrompt: () => null }));

describe('/login Create an account keeps ref and utm', () => {
  it('carries ref and utm_* (normalised) and drops other params', () => {
    render(
      <MemoryRouter initialEntries={['/login?REF=MRK7N2P9QX&utm_source=x&next=%2Fapp&foo=1']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register?ref=MRK7N2P9QX&utm_source=x',
    );
  });

  it('plain /login links to /register', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
  });
});
