import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ComingSoon } from './ComingSoon';
import { BetaAccess } from './BetaAccess';
import { Register } from './Register';

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  adultAssuranceRequired: vi.fn(),
  startAdultAssurance: vi.fn(),
  validateInvite: vi.fn(),
  setAuth: vi.fn(),
}));

vi.mock('../api/client', () => ({
  authAPI: {
    register: mocks.register,
    adultAssuranceRequired: mocks.adultAssuranceRequired,
    startAdultAssurance: mocks.startAdultAssurance,
  },
  betaAPI: { validateInvite: mocks.validateInvite },
}));

vi.mock('../hooks/store', () => ({
  useAuthStore: (selector: (s: any) => any) => selector({ token: null, setAuth: mocks.setAuth }),
}));

vi.mock('../observability/analytics', () => ({
  trackEventOnce: vi.fn(),
  trackEvent: vi.fn(),
  getAttributionParams: () => ({}),
}));

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderApp(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Where />
      <Routes>
        <Route path="/" element={<ComingSoon />} />
        <Route path="/invite" element={<BetaAccess />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

const fillForm = () => {
  fireEvent.change(screen.getByTestId('register-username-input'), { target: { value: 'AlexLondon' } });
  fireEvent.change(screen.getByPlaceholderText('you@email.com'), { target: { value: 'alex@example.com' } });
  fireEvent.change(screen.getByTestId('register-dob-day'), { target: { value: '15' } });
  fireEvent.change(screen.getByTestId('register-dob-month'), { target: { value: '6' } });
  fireEvent.change(screen.getByTestId('register-dob-year'), { target: { value: '1995' } });
  fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
    target: { value: 'Password123!@#' },
  });
  screen.getAllByRole('checkbox').forEach((cb) => fireEvent.click(cb));
};

async function submitAndGetPayload() {
  await waitFor(() => expect(mocks.adultAssuranceRequired).toHaveBeenCalled());
  fillForm();
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
  return mocks.register.mock.calls[0][0];
}

describe('referral code carried through sign up into register', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    mocks.adultAssuranceRequired.mockResolvedValue({ data: { required: false, fixtureAllowed: false } });
    mocks.register.mockResolvedValue({
      data: { token: 't', user: { id: 'u1', name: 'AlexLondon', email: 'alex@example.com' } },
    });
  });

  it('home with ?ref=X, then Sign up free, lands on /register with ref=X and sends it at signup', async () => {
    renderApp('/?ref=PETE1&utm_source=x');
    fireEvent.click(screen.getByRole('link', { name: 'Sign up free' }));
    expect(screen.getByTestId('where').textContent).toBe('/register?ref=PETE1&utm_source=x');
    expect(screen.getByTestId('register-referral-input')).toHaveValue('PETE1');
    const payload = await submitAndGetPayload();
    expect(payload.referral_code).toBe('PETE1');
  });

  it('home with uppercase keys normalises them on the way to /register', async () => {
    renderApp('/?REF=PETE1&UTM_Source=news&utm_term=sauna&UTM_ID=c42');
    fireEvent.click(screen.getByRole('link', { name: 'Sign up free' }));
    expect(screen.getByTestId('where').textContent).toBe(
      '/register?ref=PETE1&utm_source=news&utm_term=sauna&utm_id=c42',
    );
    const payload = await submitAndGetPayload();
    expect(payload.referral_code).toBe('PETE1');
  });

  it('home with ref, then Have a code?, keeps ref and utm on /invite', () => {
    renderApp('/?REF=PETE1&UTM_Source=x&utm_id=c42');
    fireEvent.click(screen.getByRole('link', { name: 'Have a code?' }));
    expect(screen.getByTestId('where').textContent).toBe('/invite?ref=PETE1&utm_source=x&utm_id=c42');
  });

  it('/invite with ref, then Sign up free, lands on /register with ref and sends it at signup', async () => {
    renderApp('/invite?ref=PETE1&utm_id=c42');
    fireEvent.click(screen.getByRole('link', { name: 'Sign up free' }));
    expect(screen.getByTestId('where').textContent).toBe('/register?ref=PETE1&utm_id=c42');
    const payload = await submitAndGetPayload();
    expect(payload.referral_code).toBe('PETE1');
  });

  it('/invite with ref and a valid invite code goes to /register with both', async () => {
    mocks.validateInvite.mockResolvedValue({ data: { code: 'MENRUSHABCD1234' } });
    renderApp('/invite?REF=PETE1&utm_term=sauna');
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'MENRUSH-ABCD-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() =>
      expect(screen.getByTestId('where').textContent).toBe(
        '/register?invite=MENRUSHABCD1234&ref=PETE1&utm_term=sauna',
      ),
    );
    const payload = await submitAndGetPayload();
    expect(payload.referral_code).toBe('PETE1');
  });

  it('register reads an uppercase REF key directly', async () => {
    renderApp('/register?REF=pete1');
    expect(screen.getByTestId('register-referral-input')).toHaveValue('PETE1');
  });
});
