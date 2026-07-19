const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function normalizeIdImageFile(file: File): { file: File | null; error?: string } {
  return normalizeProfileImageFile(file);
}

export function normalizeProfileImageFile(file: File): { file: File | null; error?: string } {
  let type = file.type;
  if (!type) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
    else if (ext === 'png') type = 'image/png';
    else if (ext === 'webp') type = 'image/webp';
  }

  if (type === 'image/heic' || type === 'image/heif') {
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
