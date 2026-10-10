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

  it('hardens "Opening Veriff…": shows skip and back buttons during liveness phase and allows skipping', async () => {
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

    // In liveness phase, skip button MUST be present so user is never stuck
    const livenessSkip = screen.getByTestId('adult-assurance-liveness-skip');
    expect(livenessSkip).toBeInTheDocument();
    expect(livenessSkip).toHaveTextContent('Skip / Continue without Veriff');

    const backBtn = screen.getByTestId('adult-assurance-liveness-back');
    expect(backBtn).toBeInTheDocument();

    // Clicking skip while stuck on Opening Veriff closes the frame and calls onSkip
    fireEvent.click(livenessSkip);
    expect(mocks.closeFrame).toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
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
});
