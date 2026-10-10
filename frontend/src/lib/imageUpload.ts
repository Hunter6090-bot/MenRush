const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const HEIC_IMAGE_TYPES = [
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
] as const;

function isHeicImageFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase();
  return HEIC_IMAGE_TYPES.includes(type as (typeof HEIC_IMAGE_TYPES)[number])
    || ext === 'heic'
    || ext === 'heif';
}

export async function normalizeIdImageFile(
  file: File,
): Promise<{ file: File | null; error?: string }> {
  if (!isHeicImageFile(file)) return normalizeProfileImageFile(file);

  if (file.size > 12 * 1024 * 1024) {
    return { file: null, error: 'Image is too large (max 12 MB).' };
  }

  try {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const jpeg = Array.isArray(converted) ? converted[0] : converted;
    if (!jpeg) throw new Error('empty_conversion');

    const basename = file.name.replace(/\.(heic|heif)$/i, '') || 'id-photo';
    return {
      file: new File([jpeg], `${basename}.jpg`, {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      }),
    };
  } catch {
    return {
      file: null,
      error: 'Could not prepare this HEIC photo. Try exporting it as a JPEG and upload again.',
    };
  }
}

export function normalizeProfileImageFile(file: File): { file: File | null; error?: string } {
  let type = file.type;
  if (!type) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
    else if (ext === 'png') type = 'image/png';
    else if (ext === 'webp') type = 'image/webp';
  }

  if (HEIC_IMAGE_TYPES.includes(type as (typeof HEIC_IMAGE_TYPES)[number])) {
    return {
      file: null,
      error:
        'HEIC photos are not supported. Pick a JPEG/PNG from your gallery, or set iPhone Camera → Formats → Most Compatible.',
    };
  }

  if (!type || !ACCEPTED_IMAGE_TYPES.includes(type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { file: null, error: 'Only JPEG, PNG or WebP images can be uploaded.' };
  }

  if (file.size > 12 * 1024 * 1024) {
    return { file: null, error: 'Image is too large (max 12 MB).' };
  }

  if (type === file.type && file.name) return { file };
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return { file: new File([file], file.name || `photo.${ext}`, { type }) };
}

/** Chat send target — Android camera originals were multi‑MB → ~50s Al→Pete. */
export const CHAT_IMAGE_MAX_EDGE = 1080;
export const CHAT_IMAGE_QUALITY = 0.7;
export const CHAT_IMAGE_SKIP_BYTES = 90_000;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_decode_failed'));
    };
    img.src = url;
  });
}

async function canvasToJpegFile(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxEdge: number,
  quality: number,
  basename: string,
): Promise<File | null> {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  );
  if (!blob) return null;
  return new File([blob], `${basename}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

/**
 * Client-side compress for chat photo send — Android→iPhone was ~50s on
 * camera originals. Falls back through createImageBitmap → HTMLImageElement.
 */
export async function compressChatImageFile(
  file: File,
  maxEdge = CHAT_IMAGE_MAX_EDGE,
  quality = CHAT_IMAGE_QUALITY,
): Promise<File> {
  const normalized = normalizeProfileImageFile(file);
  if (!normalized.file) return file;
  const input = normalized.file;

  if (input.size <= CHAT_IMAGE_SKIP_BYTES) return input;

  const basename = input.name.replace(/\.[^.]+$/, '') || 'chat-photo';

  try {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(input, {
          resizeWidth: maxEdge,
          resizeHeight: maxEdge,
          resizeQuality: 'medium',
        } as ImageBitmapOptions);
        const out = await canvasToJpegFile(
          bitmap,
          bitmap.width,
          bitmap.height,
          maxEdge,
          quality,
          basename,
        );
        bitmap.close();
        if (out && out.size < input.size) return out;
      } catch {
        const bitmap = await createImageBitmap(input);
        const out = await canvasToJpegFile(
          bitmap,
          bitmap.width,
          bitmap.height,
          maxEdge,
          quality,
          basename,
        );
        bitmap.close();
        if (out && out.size < input.size) return out;
      }
    }
  } catch {
    /* fall through to <img> path — some Android WebViews lack bitmap resize */
  }

  try {
    const img = await loadImageElement(input);
    const out = await canvasToJpegFile(img, img.naturalWidth, img.naturalHeight, maxEdge, quality, basename);
    if (out && out.size < input.size) return out;
  } catch {
    /* keep original */
  }

  return input;
}
