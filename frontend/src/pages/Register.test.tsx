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

  it.each([
    { required: false, available: true },
    { required: true, available: false },
    { required: true },
  ])('fails closed for unavailable or legacy configuration %j', async (configuration) => {
    mocks.adultAssuranceRequired.mockResolvedValue({ data: configuration });
    render(<MemoryRouter><Register /></MemoryRouter>);
    await waitFor(() => expect(mocks.adultAssuranceRequired).toHaveBeenCalled());
    fillForm(); fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(screen.getByTestId('register-error')).toHaveTextContent('currently unavailable'));
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('does not bypass age assurance on configuration network failure', async () => {
    mocks.adultAssuranceRequired.mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><Register /></MemoryRouter>);
    await waitFor(() => expect(mocks.adultAssuranceRequired).toHaveBeenCalled());
    fillForm(); fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(screen.getByTestId('register-error')).toHaveTextContent('currently unavailable'));
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('opens mandatory assurance without a skip path and retains form values on cancel', async () => {
    mocks.adultAssuranceRequired.mockResolvedValue({ data: { required:true, available:true, fixtureAllowed:false } });
    render(<MemoryRouter><Register /></MemoryRouter>);
    await waitFor(() => expect(mocks.adultAssuranceRequired).toHaveBeenCalled());
    fillForm(); fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(screen.getByTestId('adult-assurance-flow')).toBeInTheDocument());
    expect(screen.queryByTestId('adult-assurance-skip-cta')).not.toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back', exact:true }));
    expect(screen.getByPlaceholderText('you@email.com')).toHaveValue('alex@example.com');
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
