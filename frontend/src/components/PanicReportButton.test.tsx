import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanicReportButton } from './PanicReportButton';

const reportUser = vi.fn();

vi.mock('../api/client', () => ({
  usersAPI: {
    reportUser: (...args: unknown[]) => reportUser(...args),
  },
}));

describe('PanicReportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportUser.mockResolvedValue({ data: { reported: true, id: 'r1' } });
  });

  it('one-tap posts to report endpoint with thread_id', async () => {
    const user = userEvent.setup();
    const onNotice = vi.fn();
    render(
      <PanicReportButton
        reportedUserId="peer-1"
        threadId="dm:aaa_bbb"
        onNotice={onNotice}
      />,
    );

    await user.click(screen.getByTestId('panic-report-button'));

    await waitFor(() => {
      expect(reportUser).toHaveBeenCalledWith('peer-1', 'other', undefined, 'dm:aaa_bbb');
    });
    expect(onNotice).toHaveBeenCalledWith("Report sent. We'll take a look.", 'success');
    expect(screen.getByLabelText('Report sent')).toBeInTheDocument();
  });

  it('does not invent a second report while already sent', async () => {
    const user = userEvent.setup();
    render(<PanicReportButton reportedUserId="peer-1" threadId="room:room-9" />);
    await user.click(screen.getByTestId('panic-report-button'));
    await waitFor(() => expect(reportUser).toHaveBeenCalledTimes(1));
    await user.click(screen.getByTestId('panic-report-button'));
    expect(reportUser).toHaveBeenCalledTimes(1);
  });
});
