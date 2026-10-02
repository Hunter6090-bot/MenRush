import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pickPreferredDesktopCamera,
  pickPreferredCameraDeviceId,
  acquireLocalMedia,
  VIRTUAL_CAMERA_REGEX,
  BUILTIN_CAMERA_REGEX,
} from './webrtcCall';

describe('desktop camera selection & virtual camera filtering', () => {
  it('correctly classifies OBS and virtual cameras with VIRTUAL_CAMERA_REGEX', () => {
    expect(VIRTUAL_CAMERA_REGEX.test('OBS Virtual Camera')).toBe(true);
    expect(VIRTUAL_CAMERA_REGEX.test('obs-camera')).toBe(true);
    expect(VIRTUAL_CAMERA_REGEX.test('Snap Camera')).toBe(true);
    expect(VIRTUAL_CAMERA_REGEX.test('DroidCam Source')).toBe(true);
    expect(VIRTUAL_CAMERA_REGEX.test('Camo Camera')).toBe(true);
    expect(VIRTUAL_CAMERA_REGEX.test('FaceTime HD Camera')).toBe(false);
    expect(VIRTUAL_CAMERA_REGEX.test('Built-in iSight')).toBe(false);
    expect(VIRTUAL_CAMERA_REGEX.test('Logitech StreamCam')).toBe(false);
  });

  it('correctly classifies built-in / FaceTime cameras with BUILTIN_CAMERA_REGEX', () => {
    expect(BUILTIN_CAMERA_REGEX.test('FaceTime HD Camera (Built-in)')).toBe(true);
    expect(BUILTIN_CAMERA_REGEX.test('MacBook Pro Camera')).toBe(true);
    expect(BUILTIN_CAMERA_REGEX.test('Integrated Webcam')).toBe(true);
    expect(BUILTIN_CAMERA_REGEX.test('OBS Virtual Camera')).toBe(false);
  });

  it('prefers FaceTime/Built-in over OBS Virtual Camera', () => {
    const devices = [
      {
        deviceId: 'obs-id',
        kind: 'videoinput' as const,
        label: 'OBS Virtual Camera',
        groupId: 'g1',
        toJSON: () => ({}),
      },
      {
        deviceId: 'facetime-id',
        kind: 'videoinput' as const,
        label: 'FaceTime HD Camera',
        groupId: 'g2',
        toJSON: () => ({}),
      },
    ];

    const preferred = pickPreferredDesktopCamera(devices);
    expect(preferred).toBeDefined();
    expect(preferred?.deviceId).toBe('facetime-id');
    expect(preferred?.label).toBe('FaceTime HD Camera');
  });

  it('prefers non-virtual external webcam over OBS when built-in camera is absent', () => {
    const devices = [
      {
        deviceId: 'obs-id',
        kind: 'videoinput' as const,
        label: 'OBS Virtual Camera',
        groupId: 'g1',
        toJSON: () => ({}),
      },
      {
        deviceId: 'logi-id',
        kind: 'videoinput' as const,
        label: 'Logitech Brio 4K',
        groupId: 'g2',
        toJSON: () => ({}),
      },
    ];

    const preferred = pickPreferredDesktopCamera(devices);
    expect(preferred).toBeDefined();
    expect(preferred?.deviceId).toBe('logi-id');
  });

  it('falls back to OBS Virtual Camera when no other cameras exist', () => {
    const devices = [
      {
        deviceId: 'obs-id',
        kind: 'videoinput' as const,
        label: 'OBS Virtual Camera',
        groupId: 'g1',
        toJSON: () => ({}),
      },
    ];

    const preferred = pickPreferredDesktopCamera(devices);
    expect(preferred).toBeDefined();
    expect(preferred?.deviceId).toBe('obs-id');
  });
});

describe('acquireLocalMedia on desktop', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('acquires preferred FaceTime camera when enumerated devices are available', async () => {
    const mockDevices = [
      {
        deviceId: 'obs-id',
        kind: 'videoinput' as const,
        label: 'OBS Virtual Camera',
        groupId: 'g1',
        toJSON: () => ({}),
      },
      {
        deviceId: 'facetime-id',
        kind: 'videoinput' as const,
        label: 'FaceTime HD Camera',
        groupId: 'g2',
        toJSON: () => ({}),
      },
    ];

    const mockTrack = {
      kind: 'video',
      id: 'video-1',
      label: 'FaceTime HD Camera',
      readyState: 'live',
      getSettings: () => ({ deviceId: 'facetime-id' }),
      stop: vi.fn(),
    };

    const mockStream = {
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
      getAudioTracks: () => [],
      removeTrack: vi.fn(),
      addTrack: vi.fn(),
    };

    const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
      return mockStream as unknown as MediaStream;
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn(async () => mockDevices),
        getUserMedia,
      },
    });

    const stream = await acquireLocalMedia();
    expect(stream).toBeTruthy();
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          deviceId: { exact: 'facetime-id' },
        }),
      }),
    );
  });

  it('swaps out OBS camera for FaceTime camera if initial stream defaulted to OBS', async () => {
    const mockDevices = [
      {
        deviceId: 'obs-id',
        kind: 'videoinput' as const,
        label: 'OBS Virtual Camera',
        groupId: 'g1',
        toJSON: () => ({}),
      },
      {
        deviceId: 'facetime-id',
        kind: 'videoinput' as const,
        label: 'FaceTime HD Camera',
        groupId: 'g2',
        toJSON: () => ({}),
      },
    ];

    const obsTrack = {
      kind: 'video',
      id: 'video-obs',
      label: 'OBS Virtual Camera',
      readyState: 'live',
      getSettings: () => ({ deviceId: 'obs-id' }),
      stop: vi.fn(),
    };

    const faceTimeTrack = {
      kind: 'video',
      id: 'video-ft',
      label: 'FaceTime HD Camera',
      readyState: 'live',
      getSettings: () => ({ deviceId: 'facetime-id' }),
      stop: vi.fn(),
    };

    let streamTracks = [obsTrack];
    const initialStream = {
      getTracks: () => streamTracks,
      getVideoTracks: () => streamTracks.filter((t) => t.kind === 'video'),
      getAudioTracks: () => [],
      removeTrack: vi.fn((t) => {
        streamTracks = streamTracks.filter((x) => x !== t);
      }),
      addTrack: vi.fn((t) => {
        streamTracks.push(t);
      }),
    };

    const betterStream = {
      getVideoTracks: () => [faceTimeTrack],
      getTracks: () => [faceTimeTrack],
    };

    const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
      const video = constraints.video as MediaTrackConstraints | undefined;
      const deviceId = video && typeof video === 'object' && 'deviceId' in video ? video.deviceId : undefined;
      if (deviceId && typeof deviceId === 'object' && 'exact' in deviceId && deviceId.exact === 'facetime-id') {
        return betterStream as unknown as MediaStream;
      }
      return initialStream as unknown as MediaStream;
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        // First enumerate returns devices with labels
        enumerateDevices: vi.fn(async () => mockDevices),
        getUserMedia,
      },
    });

    const stream = await acquireLocalMedia();
    expect(stream).toBeTruthy();
  });
});
