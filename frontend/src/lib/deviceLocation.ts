/**
 * Device GPS for MenRush proximity — never invent city pins.
 * High-accuracy first, then low-accuracy fallback (desktop / weak GPS).
 * 18+ product; location shared only while the app is used.
 */

export type DeviceLocationError =
  | 'insecure'
  | 'unsupported'
  | 'denied'
  | 'timeout'
  | 'unavailable'
  | 'save_failed';

export type DeviceLocationResult =
  | { ok: true; lat: number; lng: number; accuracy?: number }
  | { ok: false; error: DeviceLocationError; message: string };

const ERROR_COPY: Record<DeviceLocationError, string> = {
  insecure: 'Location needs HTTPS. Open menrush.com (not a random IP), then allow location.',
  unsupported: 'This browser cannot share location. Use Chrome or Safari on your phone.',
  denied: 'Location is blocked. Allow it in browser or phone settings, then try again.',
  timeout: 'Could not get a GPS fix in time. Move near a window and try again.',
  unavailable: 'Location is unavailable right now. Check system Location Services, then try again.',
  save_failed: 'Got your position but could not save it. Check your connection and try again.',
};

function mapGeoError(err: GeolocationPositionError | null | undefined): DeviceLocationError {
  if (!err) return 'unavailable';
  if (err.code === err.PERMISSION_DENIED) return 'denied';
  if (err.code === err.TIMEOUT) return 'timeout';
  return 'unavailable';
}

function getPositionOnce(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Request precise location with high accuracy, then network/Wi‑Fi fallback.
 * Does not write to the API — caller saves via usersAPI.updateLocation.
 */
export async function requestDeviceLocation(): Promise<DeviceLocationResult> {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'unsupported', message: ERROR_COPY.unsupported };
  }
  if (!window.isSecureContext) {
    return { ok: false, error: 'insecure', message: ERROR_COPY.insecure };
  }
  if (!navigator.geolocation) {
    return { ok: false, error: 'unsupported', message: ERROR_COPY.unsupported };
  }

  try {
    const high = await getPositionOnce({
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 0,
    });
    return {
      ok: true,
      lat: high.coords.latitude,
      lng: high.coords.longitude,
      accuracy: high.coords.accuracy,
    };
  } catch (highErr) {
    const highKind = mapGeoError(highErr as GeolocationPositionError);
    // Permission denied — do not retry; browser will keep failing.
    if (highKind === 'denied') {
      return { ok: false, error: 'denied', message: ERROR_COPY.denied };
    }
  }

  try {
    const low = await getPositionOnce({
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 60_000,
    });
    return {
      ok: true,
      lat: low.coords.latitude,
      lng: low.coords.longitude,
      accuracy: low.coords.accuracy,
    };
  } catch (lowErr) {
    const kind = mapGeoError(lowErr as GeolocationPositionError);
    return { ok: false, error: kind, message: ERROR_COPY[kind] };
  }
}

export function deviceLocationErrorMessage(error: DeviceLocationError): string {
  return ERROR_COPY[error];
}
