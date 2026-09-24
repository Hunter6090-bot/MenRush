import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { AdultAssuranceFlow } from './AdultAssuranceFlow';

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  startId: vi.fn(),
  status: vi.fn(),
  submitted: vi.fn(),
  fixture: vi.fn(),
  launch: vi.fn(),
  closeFrame: vi.fn(),
}));

vi.mock('../api/client', () => ({
  authAPI: {
    startAdultAssurance: mocks.start,
    startAdultAssuranceId: mocks.startId,
    adultAssuranceStatus: mocks.status,
    markAdultAssuranceSubmitted: mocks.submitted,
    adultAssuranceFixture: mocks.fixture,
  },
}));

vi.mock('../lib/veriff', () => ({
  launchVeriffInContext: mocks.launch,
}));

describe('AdultAssuranceFlow', () => {
  const onComplete = vi.fn();
  const onCancel = vi.fn();
  const onSkip = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.start.mockResolvedValue({
      data: {
        sessionId: 'session-123',
        sessionUrl: 'https://magic.veriff.me/v/session-123',
      },
    });
    mocks.launch.mockReturnValue({ close: mocks.closeFrame });
  });

  it('renders Skip / Continue without Veriff button on intro and calls onSkip when clicked', () => {
    render(
      <AdultAssuranceFlow
        fixtureAllowed={false}
        required={false}
        onComplete={onComplete}
        onCancel={onCancel}
        onSkip={onSkip}
      />,
    );

    const continueBtn = screen.getByTestId('adult-assurance-intro-cta');
    expect(continueBtn).toBeInTheDocument();
    expect(continueBtn).toHaveTextContent('Continue with Veriff');

    const skipBtn = screen.getByTestId('adult-assurance-skip-cta');
    expect(skipBtn).toBeInTheDocument();
    expect(skipBtn).toHaveTextContent('Skip / Continue without Veriff');

    fireEvent.click(skipBtn);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('hardens "Opening Veriff…": shows only back during mandatory liveness', async () => {
    render(
      <AdultAssuranceFlow
        fixtureAllowed={false}
        required={true}
        onComplete={onComplete}
        onCancel={onCancel}
        onSkip={onSkip}
      />,
    );

    // Click Continue with Veriff
    const continueBtn = screen.getByTestId('adult-assurance-intro-cta');
    fireEvent.click(continueBtn);

    // Should transition to liveness phase ("Opening Veriff…")
    await waitFor(() => {
      expect(screen.getByTestId('adult-assurance-liveness')).toBeInTheDocument();
    });
    expect(screen.getByText('Opening Veriff…')).toBeInTheDocument();

    expect(screen.queryByTestId('adult-assurance-liveness-skip')).not.toBeInTheDocument();
    expect(screen.getByTestId('adult-assurance-liveness-back')).toBeInTheDocument();
    expect(onSkip).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('allows cancelling from Opening Veriff… back to the form', async () => {
    render(
      <AdultAssuranceFlow
        fixtureAllowed={false}
        required={true}
        onComplete={onComplete}
        onCancel={onCancel}
        onSkip={onSkip}
      />,
    );

    fireEvent.click(screen.getByTestId('adult-assurance-intro-cta'));

    await waitFor(() => {
      expect(screen.getByTestId('adult-assurance-liveness')).toBeInTheDocument();
    });

    const backBtn = screen.getByTestId('adult-assurance-liveness-back');
    fireEvent.click(backBtn);

    expect(mocks.closeFrame).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it('lets an assured adult skip optional ID and uses the latest one-time token', async () => {
    mocks.submitted.mockResolvedValue({});
    mocks.status.mockResolvedValueOnce({ data: {status:'passed', assurance_token:'first-token'} })
      .mockResolvedValueOnce({ data: {status:'passed', assurance_token:'fresh-token'} });
    render(<AdultAssuranceFlow fixtureAllowed={false} required onComplete={onComplete} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('adult-assurance-intro-cta'));
    await waitFor(()=>expect(mocks.launch).toHaveBeenCalled());
    act(()=>mocks.launch.mock.calls[0][1].onSubmitted());
    await waitFor(()=>expect(screen.getByTestId('adult-assurance-upsell-skip')).toBeInTheDocument(), {timeout:3000});
    fireEvent.click(screen.getByTestId('adult-assurance-upsell-skip'));
    await waitFor(()=>expect(onComplete).toHaveBeenCalledWith({token:'fresh-token', idVerified:false}));
    expect(mocks.startId).not.toHaveBeenCalled();
  });
  it('uses account-bound endpoints and completes without an ID upsell for existing users', async () => {
    mocks.submitted.mockResolvedValue({});
    mocks.status.mockResolvedValue({data:{status:'passed',assurance_token:'bound-token'}});
    render(<AdultAssuranceFlow fixtureAllowed={false} required account onComplete={onComplete} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('adult-assurance-intro-cta'));
    await waitFor(()=>expect(mocks.launch).toHaveBeenCalled());
    act(()=>mocks.launch.mock.calls[0][1].onSubmitted());
    await waitFor(()=>expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({token:'bound-token'})));
    expect(mocks.start).toHaveBeenCalledWith(true);
    expect(mocks.status).toHaveBeenCalledWith('session-123',true);
    expect(mocks.startId).not.toHaveBeenCalled();
  });

});
