import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanicReportButton } from './PanicReportButton';
import { usersAPI } from '../api/client';

vi.mock('../api/client', () => ({
  usersAPI: {
    reportToSentinel: vi.fn().mockResolvedValue({ data: { queue: 'SENTINEL' } }),
  },
}));

describe('PanicReportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('one-tap posts the thread to the SENTINEL queue', async () => {
    const user = userEvent.setup();
    const onNotice = vi.fn();
    render(<PanicReportButton peerId="peer-1" conversationId="peer-1" onNotice={onNotice} />);

    await user.click(screen.getByTestId('panic-report-button'));
    expect(usersAPI.reportToSentinel).toHaveBeenCalledWith({
      reason: 'panic',
      details: 'One-tap panic / report',
      reported_id: 'peer-1',
      conversation_id: 'peer-1',
      room_id: undefined,
      source: 'panic',
    });
    expect(onNotice).toHaveBeenCalled();
  });
});
