export type CaptureQuality = {
  ok: boolean;
  brightness: number;
  sharpness: number;
  message: string;
};

type RegionStats = {
  brightness: number;
  sharpness: number;
  variance: number;
};

function sampleRegion(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  size = 64,
): RegionStats | null {
  const canvas = ctx.canvas;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  let brightnessSum = 0;
  const gray = new Float32Array(size * size);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = lum;
    brightnessSum += lum;
  }

  const brightness = brightnessSum / gray.length;

  let variance = 0;
  for (let p = 0; p < gray.length; p++) {
    const d = gray[p] - brightness;
    variance += d * d;
  }
  variance /= gray.length;

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

  return { brightness, sharpness, variance };
}

export type DocumentTemplateKind = 'passport' | 'licence';

type FrameBounds = { left: number; top: number; width: number; height: number };

export function documentFrameBounds(
  w: number,
  h: number,
  template: DocumentTemplateKind = 'licence',
): FrameBounds {
  if (template === 'passport') {
    const width = w * 0.76;
    const height = h * 0.7;
    return { left: (w - width) / 2, top: (h - height) / 2, width, height };
  }
  const width = w * 0.86;
  const height = width / 1.58;
  return { left: (w - width) / 2, top: (h - height) / 2, width, height };
}

export function selfieFrameBounds(w: number, h: number): FrameBounds {
  const height = h * 0.68;
  const width = Math.min(height * 0.75, w * 0.68);
  return { left: (w - width) / 2, top: (h - height) / 2, width, height };
}

function coverFrameSourceBounds(
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
  displayedFrame: FrameBounds,
): FrameBounds | null {
  if (!videoWidth || !videoHeight || !displayWidth || !displayHeight) return null;

  const scale = Math.max(displayWidth / videoWidth, displayHeight / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const hiddenLeft = (renderedWidth - displayWidth) / 2;
  const hiddenTop = (renderedHeight - displayHeight) / 2;
  const left = (displayedFrame.left + hiddenLeft) / scale;
  const top = (displayedFrame.top + hiddenTop) / scale;
  const right = (displayedFrame.left + displayedFrame.width + hiddenLeft) / scale;
  const bottom = (displayedFrame.top + displayedFrame.height + hiddenTop) / scale;
  const clampedLeft = Math.max(0, Math.min(videoWidth, left));
  const clampedTop = Math.max(0, Math.min(videoHeight, top));
  const clampedRight = Math.max(0, Math.min(videoWidth, right));
  const clampedBottom = Math.max(0, Math.min(videoHeight, bottom));
  const width = clampedRight - clampedLeft;
  const height = clampedBottom - clampedTop;

  if (width < 1 || height < 1) return null;
  return { left: clampedLeft, top: clampedTop, width, height };
}

/**
 * Map the scanner guide shown over an object-cover video back to source-camera pixels.
 * This prevents saving anything outside the area the user was told would be captured.
 */
export function documentFrameSourceBounds(
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
  template: DocumentTemplateKind = 'licence',
): FrameBounds | null {
  const displayedFrame = documentFrameBounds(displayWidth, displayHeight, template);
  return coverFrameSourceBounds(
    videoWidth,
    videoHeight,
    displayWidth,
    displayHeight,
    displayedFrame,
  );
}

export function selfieFrameSourceBounds(source: HTMLVideoElement): FrameBounds | null {
  return coverFrameSourceBounds(
    source.videoWidth,
    source.videoHeight,
    source.clientWidth,
    source.clientHeight,
    selfieFrameBounds(source.clientWidth, source.clientHeight),
  );
}

function frameBoundsForSource(
  source: HTMLVideoElement | HTMLCanvasElement,
  template: DocumentTemplateKind,
): FrameBounds | null {
  if (source instanceof HTMLVideoElement) {
    return documentFrameSourceBounds(
      source.videoWidth,
      source.videoHeight,
      source.clientWidth,
      source.clientHeight,
      template,
    );
  }
  return documentFrameBounds(source.width, source.height, template);
}

/** Crop the aligned ID region from a live camera frame (matches overlay + quality checks). */
export function captureDocumentRegion(
  source: HTMLVideoElement,
  template: DocumentTemplateKind,
): HTMLCanvasElement | null {
  const w = source.videoWidth;
  const h = source.videoHeight;
  if (!w || !h) return null;

  const frame = documentFrameSourceBounds(
    w,
    h,
    source.clientWidth,
    source.clientHeight,
    template,
  );
  if (!frame) return null;
  const { left, top, width, height } = frame;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, left, top, width, height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Capture only the portrait region represented by the verification selfie oval. */
export function captureSelfieRegion(
  source: HTMLVideoElement,
  mirror = false,
): HTMLCanvasElement | null {
  const frame = selfieFrameSourceBounds(source);
  if (!frame) return null;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(frame.width);
  canvas.height = Math.round(frame.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    source,
    frame.left,
    frame.top,
    frame.width,
    frame.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

/** Sample centre + corner regions to confirm the ID fills the frame from all angles. */
export function assessDocumentAlignment(
  source: HTMLVideoElement | HTMLCanvasElement,
  template: 'passport' | 'licence' = 'licence',
): CaptureQuality {
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!w || !h) {
    return { ok: false, brightness: 0, sharpness: 0, message: 'Starting camera…' };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { ok: false, brightness: 0, sharpness: 0, message: 'Could not read camera.' };
  }

  const frame = frameBoundsForSource(source, template);
  if (!frame) {
    return { ok: false, brightness: 0, sharpness: 0, message: 'Could not map camera frame.' };
  }
  const patchW = frame.width * 0.18;
  const patchH = frame.height * 0.18;
  const insetX = frame.width * 0.06;
  const insetY = frame.height * 0.06;

  const corners = [
    { x: frame.left + insetX, y: frame.top + insetY },
    { x: frame.left + frame.width - insetX - patchW, y: frame.top + insetY },
    { x: frame.left + insetX, y: frame.top + frame.height - insetY - patchH },
    { x: frame.left + frame.width - insetX - patchW, y: frame.top + frame.height - insetY - patchH },
  ];

  const cornerStats = corners.map(({ x, y }) => sampleRegion(ctx, source, x, y, patchW, patchH));
  if (cornerStats.some((stats) => !stats)) {
    return { ok: false, brightness: 0, sharpness: 0, message: 'Could not read camera.' };
  }

  const center = sampleRegion(
    ctx,
    source,
    frame.left + frame.width * 0.2,
    frame.top + frame.height * 0.2,
    frame.width * 0.6,
    frame.height * 0.6,
    96,
  );
  if (!center) {
    return { ok: false, brightness: 0, sharpness: 0, message: 'Could not read camera.' };
  }

  const minCornerBright = 42;
  const minCornerVariance = 180;
  const minCornerSharp = 55;
  const darkCorners = cornerStats.filter((stats) => stats!.brightness < minCornerBright).length;
  const flatCorners = cornerStats.filter((stats) => stats!.variance < minCornerVariance).length;
  const softCorners = cornerStats.filter((stats) => stats!.sharpness < minCornerSharp).length;

  if (darkCorners >= 2) {
    return {
      ok: false,
      brightness: center.brightness,
      sharpness: center.sharpness,
      message: 'Show all four corners inside the frame.',
    };
  }
  if (flatCorners >= 2) {
    return {
      ok: false,
      brightness: center.brightness,
      sharpness: center.sharpness,
      message: 'Move closer — fill the frame with your ID.',
    };
  }
  if (softCorners >= 2) {
    return {
      ok: false,
      brightness: center.brightness,
      sharpness: center.sharpness,
      message: 'Hold steady — image is blurry.',
    };
  }

  const minBright = 55;
  const maxBright = 215;
  const minSharp = 120;

  if (center.brightness < minBright) {
    return {
      ok: false,
      brightness: center.brightness,
      sharpness: center.sharpness,
      message: 'Too dark — move to better light.',
    };
  }
  if (center.brightness > maxBright) {
    return {
      ok: false,
      brightness: center.brightness,
      sharpness: center.sharpness,
      message: 'Too bright — reduce glare or tilt slightly.',
    };
  }
  if (center.sharpness < minSharp) {
    return {
      ok: false,
      brightness: center.brightness,
      sharpness: center.sharpness,
      message: 'Hold steady — text must be sharp.',
    };
  }

  return {
    ok: true,
    brightness: center.brightness,
    sharpness: center.sharpness,
    message: 'Aligned — tap Capture photo',
  };
}

/** Sample the centre crop of a video frame for document/selfie quality heuristics. */
export function assessFrameQuality(
  source: HTMLVideoElement | HTMLCanvasElement,
  mode: 'document' | 'selfie',
  template: 'passport' | 'licence' = 'licence',
): CaptureQuality {
  if (mode === 'document') {
    return assessDocumentAlignment(source, template);
  }

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

  const frame = source instanceof HTMLVideoElement
    ? selfieFrameSourceBounds(source)
    : selfieFrameBounds(source.width, source.height);
  if (!frame) {
    return { ok: false, brightness: 0, sharpness: 0, message: 'Could not map camera frame.' };
  }
  ctx.drawImage(source, frame.left, frame.top, frame.width, frame.height, 0, 0, size, size);

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

  const minSharp = 80;
  const minBright = 45;
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
    message: 'Face aligned — tap Capture selfie',
  };
}
