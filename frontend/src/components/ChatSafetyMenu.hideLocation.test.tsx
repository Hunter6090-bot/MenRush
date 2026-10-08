import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatSafetyMenu } from './ChatSafetyMenu';

const mocks = vi.hoisted(() => ({
  listHidden: vi.fn(),
  hide: vi.fn(),
  unhide: vi.fn(),
}));

vi.mock('../api/client', () => ({
  usersAPI: { blockUser: vi.fn(), reportUser: vi.fn() },
  locationPrivacyAPI: { listHidden: mocks.listHidden, hide: mocks.hide, unhide: mocks.unhide },
}));

function renderMenu(showHideLocation: boolean, onNotice = vi.fn()) {
  render(
    <MemoryRouter>
      <ChatSafetyMenu peerId="peer-1" peerName="Nick" showHideLocation={showHideLocation} onNotice={onNotice} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Chat options' }));
  return onNotice;
}

describe('ChatSafetyMenu: Hide my location', () => {
  beforeEach(() => {
    mocks.listHidden.mockReset().mockResolvedValue({ data: { hidden: [], limit: 500 } });
    mocks.hide.mockReset().mockResolvedValue({ data: { hidden: true } });
    mocks.unhide.mockReset().mockResolvedValue({ data: { hidden: false } });
  });

  it('is not shown in chat menus', () => {
    renderMenu(false);
    expect(screen.queryByTestId('menu-hide-location')).not.toBeInTheDocument();
    expect(mocks.listHidden).not.toHaveBeenCalled();
  });

  it('keeps Report and Block in the menu next to it', async () => {
    renderMenu(true);
    expect(screen.getByRole('menuitem', { name: 'Report Nick' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Block Nick' })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'Hide my location' })).toBeInTheDocument();
  });

  it('hides location from this person', async () => {
    const onNotice = renderMenu(true);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Hide my location' }));
    await waitFor(() => expect(mocks.hide).toHaveBeenCalledWith('peer-1'));
    expect(onNotice).toHaveBeenCalledWith("Nick won't see you nearby or on the map.", 'success');
  });

  it('offers Show my location when already hidden', async () => {
    mocks.listHidden.mockResolvedValue({
      data: { hidden: [{ id: 'peer-1', name: 'Nick', photo_url: null, hidden_at: '2026-10-01T10:00:00Z' }], limit: 500 },
    });
    const onNotice = renderMenu(true);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Show my location' }));
    await waitFor(() => expect(mocks.unhide).toHaveBeenCalledWith('peer-1'));
    expect(onNotice).toHaveBeenCalledWith('Nick can see you nearby again.', 'success');
  });

  it('asks for Premium when the server says so', async () => {
    mocks.hide.mockRejectedValue({ response: { status: 402, data: { error: 'premium_required' } } });
    const onNotice = renderMenu(true);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Hide my location' }));
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Premium hides your location.', 'error'));
  });
});
