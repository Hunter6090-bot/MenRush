import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { PulseFab } from './PulseFab';

vi.mock('../lib/pulseIntro', () => ({
  isPulseIntroDismissed: () => true,
  dismissPulseIntro: vi.fn(),
}));

function renderPulse(props: Partial<ComponentProps<typeof PulseFab>> = {}) {
  const onStartPulse = vi.fn().mockResolvedValue(undefined);
  const onStopPulse = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <MemoryRouter>
      <PulseFab
        isPulsing={false}
        onStartPulse={onStartPulse}
        onStopPulse={onStopPulse}
        {...props}
      />
    </MemoryRouter>,
  );
  return { ...utils, onStartPulse, onStopPulse };
}

describe('PulseFab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the sheet when openRequestId increments', async () => {
    const { rerender, onStartPulse } = renderPulse({ openRequestId: 0 });
    expect(screen.queryByTestId('pulse-modal')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PulseFab
          isPulsing={false}
          onStartPulse={onStartPulse}
          openRequestId={1}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pulse-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pulse-start')).toBeInTheDocument();
  });

  it('stays clickable on cooldown and explains with a MenRush+ path', async () => {
    const user = userEvent.setup();
    const next = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    renderPulse({ nextPulseAllowedAt: next, isPremium: false });

    const fab = screen.getByTestId('pulse-fab');
    expect(fab).toBeEnabled();
    await user.click(fab);

    expect(screen.getByTestId('pulse-modal')).toBeInTheDocument();
    expect(screen.getByTestId('pulse-cooldown-copy')).toBeInTheDocument();
    const premium = screen.getByTestId('pulse-cooldown-premium');
    expect(premium).toHaveAttribute('href', '/premium');
    expect(screen.queryByTestId('pulse-start')).not.toBeInTheDocument();
  });
});
