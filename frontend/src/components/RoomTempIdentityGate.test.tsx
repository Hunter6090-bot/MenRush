import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RoomTempIdentityGate,
  buildNameSuggestions,
  resolveTempPhotoSrc,
  type RoomTempIdentityPayload,
} from './RoomTempIdentityGate';

vi.mock('../api/client', () => ({
  roomsAPI: {
    getTempIdentity: vi.fn(),
    deleteTempIdentity: vi.fn(),
    uploadTempPhoto: vi.fn(),
  },
}));

vi.mock('./SelfieCaptureModal', () => ({
  SelfieCaptureModal: ({
    open,
    onCapture,
    onClose,
  }: {
    open: boolean;
    onCapture: (file: File) => void;
    onClose: () => void;
    onError: (message: string) => void;
  }) =>
    open ? (
      <div data-testid="room-temp-selfie-modal" role="dialog" aria-label="Take a temporary group photo">
        <button
          type="button"
          data-testid="room-temp-selfie-capture"
          onClick={() =>
            onCapture(new File([new Uint8Array([1, 2, 3])], 'selfie.jpg', { type: 'image/jpeg' }))
          }
        >
          Use photo
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    ) : null,
}));

import { roomsAPI } from '../api/client';

const mockedGet = vi.mocked(roomsAPI.getTempIdentity);
const mockedDelete = vi.mocked(roomsAPI.deleteTempIdentity);
const mockedUpload = vi.mocked(roomsAPI.uploadTempPhoto);

type GateProps = {
  roomId: string;
  roomName: string;
  roomDescription?: string;
  roomRules?: string | null;
  activeCount?: number | null;
  roomTheme?: string | null;
  onReady: (identity: RoomTempIdentityPayload) => void | Promise<void>;
  onCancel?: () => void;
};

function renderGate(overrides: Partial<GateProps> = {}) {
  const onReady = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = render(
    <RoomTempIdentityGate
      roomId="room-1"
      roomName="Bears & Cubs"
      roomTheme="Bears & Cubs"
      onReady={onReady}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { ...utils, onReady, onCancel };
}

describe('buildNameSuggestions', () => {
  it('returns tribe-aware chips for known themes', () => {
    expect(buildNameSuggestions('Bears & Cubs')).toEqual([
      'Anon Bear',
      'Cub NW',
      'Otter Quiet',
    ]);
  });

  it('falls back to generic chips when theme is unknown', () => {
    expect(buildNameSuggestions(null)).toEqual([
      'Anon Guest',
      'Just Visiting',
      'Discreet',
    ]);
  });
});

describe('resolveTempPhotoSrc', () => {
  it('passes through blob and brand paths', () => {
    expect(resolveTempPhotoSrc('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
    expect(resolveTempPhotoSrc('/brand/medallion-380.png')).toBe('/brand/medallion-380.png');
  });
});

describe('RoomTempIdentityGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGet.mockResolvedValue({ data: {} } as never);
    mockedDelete.mockResolvedValue({} as never);
    mockedUpload.mockResolvedValue({ data: { photo_url: '/uploads/room-temp/test.jpg' } } as never);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('disables CTA when name is under 2 characters', async () => {
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    const enter = screen.getByTestId('room-temp-enter');
    expect(enter).toBeDisabled();

    await user.type(screen.getByTestId('room-temp-name'), 'A');
    expect(enter).toBeDisabled();

    await user.type(screen.getByTestId('room-temp-name'), 'B');
    expect(enter).not.toBeDisabled();
  });

  it('shows inline danger error after blur when name is too short', async () => {
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    const input = screen.getByTestId('room-temp-name');
    await user.type(input, 'X');
    await user.tab();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Use 2 characters or more.');
    expect(alert).toHaveStyle({ color: '#B0432E' });
  });

  it('single save toggle sets both saveName and savePhoto on enter', async () => {
    const user = userEvent.setup();
    const { onReady } = renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await user.type(screen.getByTestId('room-temp-name'), 'Gear Bear');
    await user.click(screen.getByTestId('room-temp-save-name'));

    expect(screen.getByTestId('room-temp-save-name')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('room-temp-save-photo')).toBeChecked();

    await user.click(screen.getByTestId('room-temp-enter'));
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(onReady).toHaveBeenCalledWith({
      displayName: 'Gear Bear',
      photoUrl: undefined,
      saveName: true,
      savePhoto: true,
    });
  });

  it('suggestion chips fill the name field', async () => {
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(screen.getByTestId('room-temp-suggestions')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Anon Bear' }));
    expect(screen.getByTestId('room-temp-name')).toHaveValue('Anon Bear');
    expect(screen.getByTestId('room-temp-enter')).not.toBeDisabled();
  });

  it('Not now calls onCancel', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await user.click(screen.getByTestId('room-temp-not-now'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows anonymity promise and house rules accordion', async () => {
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    expect(
      screen.getByText('Your profile, photos and distance stay hidden.'),
    ).toBeInTheDocument();

    expect(screen.queryByTestId('room-temp-house-rules')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('room-temp-house-rules-toggle'));
    expect(screen.getByTestId('room-temp-house-rules')).toBeInTheDocument();
    expect(screen.getByText(/Adults only/i)).toBeInTheDocument();
  });

  it('keeps clear-saved behind overflow menu with stable test-id', async () => {
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    expect(screen.queryByTestId('room-temp-clear-saved')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('More options'));
    expect(screen.getByTestId('room-temp-clear-saved')).toBeInTheDocument();
  });

  it('Take photo opens the camera modal, not a file input', async () => {
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    expect(screen.queryByTestId('room-temp-camera-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('room-temp-selfie-modal')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('room-temp-take-photo'));
    expect(screen.getByTestId('room-temp-selfie-modal')).toBeInTheDocument();
  });

  it('Upload uses the gallery file input and sets photo preview on success', async () => {
    const user = userEvent.setup();
    const { onReady } = renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    const gallery = screen.getByTestId('room-temp-gallery-input') as HTMLInputElement;
    expect(gallery).not.toHaveAttribute('capture');
    expect(gallery.getAttribute('accept')).toBe('image/*');

    const file = new File([new Uint8Array([9, 8, 7])], 'avatar.png', { type: 'image/png' });
    await user.upload(gallery, file);

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledWith('room-1', file));
    await waitFor(() => expect(screen.getByTestId('room-temp-photo-preview')).toBeInTheDocument());

    await user.type(screen.getByTestId('room-temp-name'), 'Anon Bear');
    await user.click(screen.getByTestId('room-temp-enter'));
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(onReady).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Anon Bear',
        photoUrl: '/uploads/room-temp/test.jpg',
      }),
    );
  });

  it('Take photo capture uploads and shows preview', async () => {
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await user.click(screen.getByTestId('room-temp-take-photo'));
    await user.click(screen.getByTestId('room-temp-selfie-capture'));

    await waitFor(() => expect(mockedUpload).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('room-temp-photo-preview')).toBeInTheDocument());
  });

  it('shows a danger error when upload fails', async () => {
    const user = userEvent.setup();
    mockedUpload.mockRejectedValueOnce(new Error('network'));
    renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    const gallery = screen.getByTestId('room-temp-gallery-input');
    const file = new File([new Uint8Array([1])], 'bad.png', { type: 'image/png' });
    await user.upload(gallery, file);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Could not upload photo/i);
    expect(alert).toHaveStyle({ color: '#B0432E' });
    expect(screen.queryByTestId('room-temp-photo-preview')).not.toBeInTheDocument();
  });

  it('keeps previous temp photo when a re-upload fails (never clears to account)', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({
      data: {
        display_name: 'Gear Bear',
        photo_url: '/uploads/room-temp/saved.jpg',
        save_name: true,
        save_photo: true,
      },
    } as never);

    renderGate();
    await waitFor(() => expect(screen.getByTestId('room-temp-photo-preview')).toBeInTheDocument());
    const firstSrc = (screen.getByTestId('room-temp-photo-preview') as HTMLImageElement).src;

    mockedUpload.mockRejectedValueOnce(new Error('network'));
    const gallery = screen.getByTestId('room-temp-gallery-input');
    const file = new File([new Uint8Array([2])], 'next.png', { type: 'image/png' });
    await user.upload(gallery, file);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Could not upload photo/i);
    const preview = await screen.findByTestId('room-temp-photo-preview');
    expect((preview as HTMLImageElement).src).toBe(firstSrc);
  });
});
