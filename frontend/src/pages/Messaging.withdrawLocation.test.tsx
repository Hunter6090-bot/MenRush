import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Messages } from './Messaging';
import { messagesAPI, usersAPI, meetAPI } from '../api/client';

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => mockSocket,
}));

vi.mock('../hooks/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/store')>();
  return {
    ...actual,
    useAuthStore: Object.assign(
      (sel?: any) => {
        const state = { user: { id: 'user-me', name: 'Alice' } };
        return typeof sel === 'function' ? sel(state) : state;
      },
      {
        getState: () => ({ user: { id: 'user-me', name: 'Alice' } }),
      },
    ),
  };
});

vi.mock('../observability/analytics', () => ({
  trackEventOnce: vi.fn(),
  trackEvent: vi.fn(),
}));

describe('Messaging location withdraw UX', () => {
  const peerId = 'peer-bob';

  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.spyOn(usersAPI, 'getProfile').mockResolvedValue({
      data: {
        user: { id: peerId, name: 'Bob', photo_url: null },
      },
    } as any);
    vi.spyOn(meetAPI, 'getState').mockResolvedValue({
      data: { my_confirmed: false, peer_confirmed: false, mutual: false },
    } as any);
  });

  it('renders active location share with coords, Get directions, and withdraw button for sender', async () => {
    const locationMsg = {
      id: 'loc-msg-1',
      sender_id: 'user-me',
      receiver_id: peerId,
      media_type: 'location',
      message: JSON.stringify({ lat: 51.5074, lng: -0.1278 }),
      created_at: new Date().toISOString(),
      read: false,
      viewed_at: null,
      withdrawn_at: null,
    };

    vi.spyOn(messagesAPI, 'getConversation').mockResolvedValue({
      data: [locationMsg],
    } as any);

    render(
      <MemoryRouter initialEntries={[`/messages/${peerId}`]}>
        <Routes>
          <Route path="/messages/:otherId" element={<Messages />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Shared location')).toBeInTheDocument();
    });

    expect(screen.getByText(/51\.50740, -0\.12780/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get directions/i })).toBeInTheDocument();

    const withdrawBtn = screen.getByTestId('withdraw-media');
    expect(withdrawBtn).toBeInTheDocument();
    expect(withdrawBtn).toHaveTextContent(/withdraw/i);
  });

  it('allows sender to withdraw location AFTER it has been viewed by recipient', async () => {
    const user = userEvent.setup();
    const viewedLocationMsg = {
      id: 'loc-msg-2',
      sender_id: 'user-me',
      receiver_id: peerId,
      media_type: 'location',
      message: JSON.stringify({ lat: 51.5074, lng: -0.1278 }),
      created_at: new Date().toISOString(),
      read: true,
      viewed_at: '2026-09-25T08:00:00Z',
      withdrawn_at: null,
    };

    vi.spyOn(messagesAPI, 'getConversation').mockResolvedValue({
      data: [viewedLocationMsg],
    } as any);

    const withdrawSpy = vi.spyOn(messagesAPI, 'withdrawMedia').mockResolvedValue({
      data: {
        ...viewedLocationMsg,
        withdrawn_at: new Date().toISOString(),
        message: 'Location withdrawn',
        expired: true,
      },
    } as any);

    render(
      <MemoryRouter initialEntries={[`/messages/${peerId}`]}>
        <Routes>
          <Route path="/messages/:otherId" element={<Messages />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Shared location')).toBeInTheDocument();
    });

    // Withdraw button is still present even though read=true and viewed_at is stamped
    const withdrawBtn = screen.getByTestId('withdraw-media');
    expect(withdrawBtn).toBeInTheDocument();

    await user.click(withdrawBtn);
    expect(withdrawSpy).toHaveBeenCalledWith('loc-msg-2');

    // UI updates: coordinates and directions button disappear, replaced with withdrawn tombstone
    await waitFor(() => {
      expect(screen.getByTestId('media-withdrawn')).toBeInTheDocument();
    });

    expect(screen.getByText('Location withdrawn')).toBeInTheDocument();
    expect(screen.queryByText(/51\.50740/)).toBeNull();
    expect(screen.queryByRole('button', { name: /get directions/i })).toBeNull();
    expect(screen.queryByTestId('withdraw-media')).toBeNull();
  });

  it('recipient sees location and directions initially, but no withdraw button; shows withdrawn tombstone after withdraw', async () => {
    const recipientMsg = {
      id: 'loc-msg-3',
      sender_id: peerId,
      receiver_id: 'user-me',
      media_type: 'location',
      message: JSON.stringify({ lat: 51.5074, lng: -0.1278 }),
      created_at: new Date().toISOString(),
      read: true,
      viewed_at: '2026-09-25T08:00:00Z',
      withdrawn_at: null,
    };

    vi.spyOn(messagesAPI, 'getConversation').mockResolvedValue({
      data: [recipientMsg],
    } as any);

    let socketWithdrawnCallback: ((data: any) => void) | null = null;
    mockSocket.on.mockImplementation((event: string, cb: any) => {
      if (event === 'message:withdrawn') {
        socketWithdrawnCallback = cb;
      }
    });

    render(
      <MemoryRouter initialEntries={[`/messages/${peerId}`]}>
        <Routes>
          <Route path="/messages/:otherId" element={<Messages />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /get directions/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/51\.50740, -0\.12780/)).toBeInTheDocument();
    // Recipient must NOT have a withdraw button
    expect(screen.queryByTestId('withdraw-media')).toBeNull();

    // Now sender withdraws: socket delivers message:withdrawn
    expect(socketWithdrawnCallback).not.toBeNull();
    act(() => {
      socketWithdrawnCallback!({
        ...recipientMsg,
        withdrawn_at: new Date().toISOString(),
        message: 'Location withdrawn',
        expired: true,
      });
    });

    // Recipient immediately sees the withdrawn tombstone, no coords or directions remain
    await waitFor(() => {
      expect(screen.getByTestId('media-withdrawn')).toBeInTheDocument();
    });

    expect(screen.getByText('Location withdrawn')).toBeInTheDocument();
    expect(screen.queryByText(/51\.50740/)).toBeNull();
    expect(screen.queryByRole('button', { name: /get directions/i })).toBeNull();
  });
});
