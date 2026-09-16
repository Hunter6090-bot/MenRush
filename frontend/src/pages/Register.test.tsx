import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Register } from './Register';

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  adultAssuranceRequired: vi.fn(),
  startAdultAssurance: vi.fn(),
  navigate: vi.fn(),
  setAuth: vi.fn(),
}));

vi.mock('../api/client', () => ({
  authAPI: {
    register: mocks.register,
    adultAssuranceRequired: mocks.adultAssuranceRequired,
    startAdultAssurance: mocks.startAdultAssurance,
  },
}));

vi.mock('../hooks/store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({
      token: null,
      setAuth: mocks.setAuth,
    }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

describe('Register page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.adultAssuranceRequired.mockResolvedValue({
      data: { required: false, fixtureAllowed: false },
    });
  });

  const fillForm = () => {
    fireEvent.change(screen.getByTestId('register-username-input'), {
      target: { value: 'AlexLondon' },
    });
    fireEvent.change(screen.getByPlaceholderText('you@email.com'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.change(screen.getByTestId('register-dob-day'), {
      target: { value: '15' },
    });
    fireEvent.change(screen.getByTestId('register-dob-month'), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByTestId('register-dob-year'), {
      target: { value: '1995' },
    });
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'Password123!@#' },
    });
    // Consents
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));
  };

  it('submits registration directly without Veriff when required is false', async () => {
    mocks.register.mockResolvedValue({
      data: {
        token: 'test-jwt-token',
        user: { id: 'u1', name: 'AlexLondon', email: 'alex@example.com' },
      },
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.adultAssuranceRequired).toHaveBeenCalled();
    });

    // Form is directly visible (no AdultAssuranceFlow blocking the page)
    expect(screen.getByTestId('register-username-input')).toBeVisible();
    expect(screen.queryByTestId('adult-assurance-flow')).not.toBeInTheDocument();

    fillForm();

    const submitBtn = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.register.mock.calls[0][0];
    expect(payload.email).toBe('alex@example.com');
    expect(payload.name).toBe('AlexLondon');
    expect(payload.date_of_birth).toBe('1995-06-15');
    expect(payload.age).toBeGreaterThanOrEqual(18);
    // Crucial: adult_assurance_token is NOT included
    expect(payload.adult_assurance_token).toBeUndefined();

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/profile/setup', { replace: true });
    });
  });

  it('displays human-readable duplicate email error with sign-in guidance instead of generic 400', async () => {
    mocks.register.mockRejectedValue({
      message: 'Request failed with status code 400',
      response: {
        status: 400,
        data: { error: 'Email already exists' },
      },
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByTestId('register-error')).toBeInTheDocument();
    });

    const errorEl = screen.getByTestId('register-error');
    expect(errorEl).toHaveTextContent('An account with this email already exists.');
    expect(errorEl).not.toHaveTextContent('Request failed with status code 400');

    // Duplicate email guidance links
    const helpEl = screen.getByTestId('register-duplicate-email-help');
    expect(helpEl).toBeInTheDocument();
    expect(helpEl).toHaveTextContent('Sign in or reset your password.');
  });

  it('allows skipping Veriff when required is true and completing registration without adult token', async () => {
    mocks.adultAssuranceRequired.mockResolvedValue({
      data: { required: true, fixtureAllowed: false },
    });
    mocks.register.mockResolvedValue({
      data: {
        token: 'test-jwt-token',
        user: { id: 'u1', name: 'AlexLondon', email: 'alex@example.com' },
      },
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.adultAssuranceRequired).toHaveBeenCalled();
    });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    // When required, AdultAssuranceFlow is shown
    await waitFor(() => {
      expect(screen.getByTestId('adult-assurance-flow')).toBeInTheDocument();
    });

    // Tap Skip / Continue without Veriff
    const skipBtn = screen.getByTestId('adult-assurance-skip-cta');
    fireEvent.click(skipBtn);

    // Registration is submitted without adult assurance token
    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.register.mock.calls[0][0];
    expect(payload.adult_assurance_token).toBeUndefined();
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/profile/setup', { replace: true });
    });
  });
});
