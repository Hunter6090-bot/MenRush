/**
 * Board pre-join Camera / Mic toggles (Pete, exact board match).
 * Off by default, no permission prompt until a toggle is turned on, a denied
 * permission still joins, and the identity payload is unchanged.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomTempIdentityGate } from './RoomTempIdentityGate';
import { contrast, loadThemeTokens, type Theme } from '../test/themeContrast';

vi.mock('../api/client', () => ({
  roomsAPI: {
    getTempIdentity: vi.fn(async () => ({ data: {} })),
    deleteTempIdentity: vi.fn(async () => ({})),
    uploadTempPhoto: vi.fn(),
  },
}));
vi.mock('./SelfieCaptureModal', () => ({ SelfieCaptureModal: () => null }));

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

const getUserMedia = vi.fn();
const stop = vi.fn();

function grant() {
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
}
function deny() {
  getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
}

function renderGate() {
  const onReady = vi.fn().mockResolvedValue(undefined);
  const onMediaChoiceChange = vi.fn();
  render(
    <RoomTempIdentityGate
      roomId="room-1"
      roomName="Soho late"
      activeCount={4}
      onReady={onReady}
      onCancel={vi.fn()}
      onMediaChoiceChange={onMediaChoiceChange}
    />,
  );
  return { onReady, onMediaChoiceChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  });
});

describe('Camera and Mic on the join screen', () => {
  it('shows the board tiles Camera, Mic and Temp photo; both toggles off; no permission prompt', async () => {
    const { onMediaChoiceChange } = renderGate();
    const cam = screen.getByTestId('room-join-camera');
    const mic = screen.getByTestId('room-join-mic');
    expect(cam).toHaveAttribute('role', 'switch');
    expect(cam).toHaveAttribute('aria-checked', 'false');
    expect(mic).toHaveAttribute('aria-checked', 'false');
    expect(cam).toHaveTextContent('CameraOff');
    expect(mic).toHaveTextContent('MicOff');
    expect(screen.getByTestId('room-temp-photo-tile')).toHaveTextContent('Temp photo');
    await waitFor(() => expect(onMediaChoiceChange).toHaveBeenCalledWith({ camera: false, mic: false }));
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('joining with both off never asks for camera or mic', async () => {
    const user = userEvent.setup();
    const { onReady } = renderGate();
    await user.type(screen.getByTestId('room-temp-name'), 'Guest 27');
    await user.click(screen.getByTestId('room-temp-enter'));
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('turning Camera on asks for camera permission only, then releases it', async () => {
    grant();
    const user = userEvent.setup();
    const { onMediaChoiceChange } = renderGate();
    await user.click(screen.getByTestId('room-join-camera'));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
    expect(stop).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('room-join-camera')).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByTestId('room-join-camera')).toHaveTextContent('CameraOn');
    expect(onMediaChoiceChange).toHaveBeenLastCalledWith({ camera: true, mic: false });
  });

  it('turning Mic on asks for mic permission only', async () => {
    grant();
    const user = userEvent.setup();
    const { onMediaChoiceChange } = renderGate();
    await user.click(screen.getByTestId('room-join-mic'));
    const [constraints] = getUserMedia.mock.calls[0];
    expect(constraints.video).toBe(false);
    expect(constraints.audio).toBeTruthy();
    await waitFor(() => expect(onMediaChoiceChange).toHaveBeenLastCalledWith({ camera: false, mic: true }));
  });

  it('turning a toggle off does not ask again', async () => {
    grant();
    const user = userEvent.setup();
    renderGate();
    await user.click(screen.getByTestId('room-join-camera'));
    await waitFor(() => expect(screen.getByTestId('room-join-camera')).toHaveAttribute('aria-checked', 'true'));
    await user.click(screen.getByTestId('room-join-camera'));
    expect(screen.getByTestId('room-join-camera')).toHaveAttribute('aria-checked', 'false');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('a denied permission keeps it off, shows a plain 15px note, and Join still works with the same payload', async () => {
    deny();
    const user = userEvent.setup();
    const { onReady, onMediaChoiceChange } = renderGate();
    await user.click(screen.getByTestId('room-join-camera'));
    const note = await screen.findByTestId('room-join-media-note');
    expect(note).toHaveTextContent('Camera is blocked. You can still join with it off.');
    expect(note.className).toContain('text-[15px]');
    expect(screen.getByTestId('room-join-camera')).toHaveAttribute('aria-checked', 'false');
    expect(onMediaChoiceChange).toHaveBeenLastCalledWith({ camera: false, mic: false });
    await user.type(screen.getByTestId('room-temp-name'), 'Guest 27');
    await user.click(screen.getByTestId('room-temp-enter'));
    await waitFor(() =>
      expect(onReady).toHaveBeenCalledWith({
        mode: 'temp',
        displayName: 'Guest 27',
        photoUrl: '',
        saveName: false,
        savePhoto: false,
      }),
    );
  });

  it('the old "You choose camera and mic inside the room" line is gone; Take photo and Upload are behind Temp photo', async () => {
    const user = userEvent.setup();
    renderGate();
    expect(screen.queryByText(/You choose camera and mic inside the room/)).toBeNull();
    expect(screen.queryByTestId('room-temp-take-photo')).toBeNull();
    await user.click(screen.getByTestId('room-temp-photo-tile'));
    expect(screen.getByTestId('room-temp-take-photo')).toBeInTheDocument();
    expect(screen.getByTestId('room-temp-upload')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[\u2013\u2014]/);
  });
});

describe.each<Theme>(['light', 'dark'])('Camera / Mic tile contrast (%s)', (theme) => {
  it('on and off tile text is AA', async () => {
    grant();
    const user = userEvent.setup();
    renderGate();
    await user.click(screen.getByTestId('room-join-camera'));
    await waitFor(() => expect(screen.getByTestId('room-join-camera')).toHaveAttribute('aria-checked', 'true'));
    for (const id of ['room-join-camera', 'room-join-mic']) {
      const tile = screen.getByTestId(id);
      for (const span of tile.querySelectorAll('span')) {
        expect(contrast(span, theme)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
