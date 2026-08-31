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

/**
 * Client-side compress for chat photo send — cuts Pete↔Al ~15–50s uploads when
 * the camera original is multi‑MB. Falls back to the original file on failure.
 */
export async function compressChatImageFile(
  file: File,
  maxEdge = 1280,
  quality = 0.76,
): Promise<File> {
  const normalized = normalizeProfileImageFile(file);
  if (!normalized.file) return file;
  const input = normalized.file;

  // Already small enough — skip canvas work.
  if (input.size <= 350_000) return input;

  try {
    const bitmap = await createImageBitmap(input);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return input;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    );
    if (!blob || blob.size >= input.size) return input;

    const basename = input.name.replace(/\.[^.]+$/, '') || 'chat-photo';
    return new File([blob], `${basename}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return input;
  }
}
