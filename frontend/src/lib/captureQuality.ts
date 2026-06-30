export type CaptureQuality = {
  ok: boolean;
  brightness: number;
  sharpness: number;
  message: string;
};

/** Sample the centre crop of a video frame for document/selfie quality heuristics. */
export function assessFrameQuality(
  source: HTMLVideoElement | HTMLCanvasElement,
  mode: 'document' | 'selfie',
): CaptureQuality {
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!w || !h) {
    return { ok: false, brightness: 0, sharpness: 0, message: 'Starting camera…' };
  }

  const canvas = document.createElement('canvas');
  const size = 160;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { ok: false, brightness: 0, sharpness: 0, message: 'Could not read camera.' };
  }

  const cropW = w * (mode === 'document' ? 0.72 : 0.55);
  const cropH = h * (mode === 'document' ? 0.5 : 0.62);
  const sx = (w - cropW) / 2;
  const sy = (h - cropH) / 2;
  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  let brightnessSum = 0;
  const gray = new Float32Array(size * size);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = lum;
    brightnessSum += lum;
  }

  const brightness = brightnessSum / gray.length;

  let sharpness = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const lap =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - size] +
        gray[i + size];
      sharpness += lap * lap;
    }
  }
  sharpness /= (size - 2) * (size - 2);

  const minSharp = mode === 'document' ? 120 : 80;
  const minBright = mode === 'document' ? 55 : 45;
  const maxBright = 215;

  if (brightness < minBright) {
    return { ok: false, brightness, sharpness, message: 'Too dark — move to better light.' };
  }
  if (brightness > maxBright) {
    return { ok: false, brightness, sharpness, message: 'Too bright — reduce glare or tilt slightly.' };
  }
  if (sharpness < minSharp) {
    return { ok: false, brightness, sharpness, message: 'Hold steady — image is blurry.' };
  }

  return {
    ok: true,
    brightness,
    sharpness,
    message: mode === 'document' ? 'Document clear — hold still…' : 'Face clear — hold still…',
  };
}