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
