import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contrast, hardcodedColourClasses, loadThemeTokens, type Theme } from '../test/themeContrast';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RoomTempIdentityGate,
  buildNameSuggestions,
  resolveTempPhotoSrc,
  type RoomIdentityGateResult,
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

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

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
  profileName?: string | null;
  profilePhotoUrl?: string | null;
  onReady: (identity: RoomIdentityGateResult) => void | Promise<void>;
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
      profileName="Profile Bear"
      profilePhotoUrl="/uploads/profiles/bear.jpg"
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
    expect(resolveTempPhotoSrc('/brand/medallion-transparent.png')).toBe('/brand/medallion-transparent.png');
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

  it('offers keep-using-real-profile as a one-tap choice', async () => {
    const user = userEvent.setup();
    const { onReady } = renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    expect(screen.getByTestId('room-use-real-profile')).toBeInTheDocument();
    await user.click(screen.getByTestId('room-use-real-profile'));
    await waitFor(() => expect(onReady).toHaveBeenCalledWith({ mode: 'profile' }));
  });

  it('disables temp CTA when name is under 2 characters; photo is optional', async () => {
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
    expect(alert.className).toContain('text-[var(--nn-danger-text)]');
  });

  it('allows temp enter with name only — no temporary photo required', async () => {
    const user = userEvent.setup();
    const { onReady } = renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await user.type(screen.getByTestId('room-temp-name'), 'Gear Bear');
    expect(screen.getByTestId('room-temp-enter')).not.toBeDisabled();

    await user.click(screen.getByTestId('room-temp-enter'));
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(onReady).toHaveBeenCalledWith({
      mode: 'temp',
      displayName: 'Gear Bear',
      photoUrl: '',
      saveName: false,
      savePhoto: false,
    });
  });

  it('single save toggle sets both saveName and savePhoto on enter', async () => {
    const user = userEvent.setup();
    const { onReady } = renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await user.type(screen.getByTestId('room-temp-name'), 'Gear Bear');
    await user.click(screen.getByTestId('room-temp-save-name'));

    expect(screen.getByTestId('room-temp-save-name')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('room-temp-save-photo')).toBeChecked();

    const gallery = screen.getByTestId('room-temp-gallery-input') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'temp.jpg', { type: 'image/jpeg' });
    await user.upload(gallery, file);

    await waitFor(() => expect(mockedUpload).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('room-temp-enter')).not.toBeDisabled());

    await user.click(screen.getByTestId('room-temp-enter'));
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(onReady).toHaveBeenCalledWith({
      mode: 'temp',
      displayName: 'Gear Bear',
      photoUrl: '/uploads/room-temp/test.jpg',
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

  it('shows temp promise and house rules accordion', async () => {
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    expect(
      screen.getByText('Temporary name stays in this room only. Photo optional.'),
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

    await user.click(screen.getByTestId('room-temp-photo-tile'));
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
        mode: 'temp',
        displayName: 'Anon Bear',
        photoUrl: '/uploads/room-temp/test.jpg',
      }),
    );
  });

  it('Take photo capture uploads and shows preview', async () => {
    const user = userEvent.setup();
    renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());

    await user.click(screen.getByTestId('room-temp-photo-tile'));
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
    expect(alert.className).toContain('text-[var(--nn-danger-text)]');
    expect(screen.queryByTestId('room-temp-photo-preview')).not.toBeInTheDocument();
  });
});

describe('RoomTempIdentityGate matches the board (Room pre-join)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGet.mockResolvedValue({ data: {} } as never);
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

  it('shows Rooms back, room name, N in room, preview card with Preview and name chips, and Join', async () => {
    const user = userEvent.setup();
    renderGate({ activeCount: 4, roomName: 'Soho late' });
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(screen.getByTestId('room-temp-not-now')).toHaveTextContent('Rooms');
    expect(screen.getByRole('heading', { name: 'Soho late' })).toBeInTheDocument();
    expect(screen.getByTestId('room-temp-active-count')).toHaveTextContent('4 in room');
    expect(screen.getByTestId('room-temp-preview-card')).toHaveTextContent('Preview');
    expect(screen.getByTestId('room-temp-preview-name')).toHaveTextContent('Pick a name');
    await user.type(screen.getByTestId('room-temp-name'), 'Guest 27');
    expect(screen.getByTestId('room-temp-preview-name')).toHaveTextContent('Guest 27');
    expect(screen.getByTestId('room-temp-enter')).toHaveTextContent(/^Join$/);
  });

  it('hides the count when there is none (no made-up numbers)', async () => {
    renderGate({ activeCount: 0 });
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(screen.queryByTestId('room-temp-active-count')).toBeNull();
  });

  it('identity result is unchanged: Join sends the same temp payload', async () => {
    const user = userEvent.setup();
    const { onReady } = renderGate();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    await user.type(screen.getByTestId('room-temp-name'), 'Anon Guest');
    await user.click(screen.getByTestId('room-temp-enter'));
    await waitFor(() =>
      expect(onReady).toHaveBeenCalledWith({
        mode: 'temp',
        displayName: 'Anon Guest',
        photoUrl: '',
        saveName: false,
        savePhoto: false,
      }),
    );
  });

  it('every tap target is at least 44px, text is 15px or more, no dashes or beta in copy', async () => {
    renderGate({ activeCount: 3 });
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    const src = readFileSync(resolve(__dirname, 'RoomTempIdentityGate.tsx'), 'utf8');
    expect(src).not.toMatch(/\btext-(xs|sm)\b|text-\[(\d|1[0-4])px\]/);
    const gate = screen.getByTestId('room-temp-identity-gate');
    for (const el of gate.querySelectorAll('button')) {
      const cls = el.className;
      const ok = /min-h-\[(4[4-9]|[5-9]\d)px\]|\bh-11\b|\bh-1[2-9]\b/.test(cls);
      expect(ok, `${el.textContent} ${cls}`).toBe(true);
    }
    expect(gate.textContent).not.toMatch(/[\u2013\u2014]|\bbeta\b/i);
    expect(hardcodedColourClasses(gate)).toEqual([]);
  });
});

describe.each<Theme>(['light', 'dark'])('Room join contrast (%s)', (theme) => {
  beforeEach(() => {
    mockedGet.mockResolvedValue({ data: {} } as never);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
      })),
    });
  });

  it('all text is at least 4.5:1 and the Join label is AA on copper', async () => {
    const user = userEvent.setup();
    renderGate({ activeCount: 4, roomDescription: 'Late group' });
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    await user.type(screen.getByTestId('room-temp-name'), 'Guest 27');
    const gate = screen.getByTestId('room-temp-identity-gate');
    const texts = [...gate.querySelectorAll('p, span, button, label, h1')].filter(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0,
    );
    expect(texts.length).toBeGreaterThan(10);
    for (const el of texts) {
      expect(contrast(el, theme), `${el.textContent}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(screen.getByTestId('room-temp-enter'), theme)).toBeGreaterThanOrEqual(4.5);
  });
});
