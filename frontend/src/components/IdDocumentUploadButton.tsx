import { useRef, useState } from 'react';
import { normalizeIdImageFile } from '../lib/imageUpload';

interface IdDocumentUploadButtonProps {
  label?: string;
  filePrefix: string;
  onCapture: (file: File) => void;
  onError: (message: string) => void;
  className?: string;
}

/** Pick an ID photo from the device, converting Apple HEIC/HEIF images to JPEG. */
export function IdDocumentUploadButton({
  label = 'Upload photo from device',
  filePrefix,
  onCapture,
  onError,
  className,
}: IdDocumentUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.files?.[0];
    event.target.value = '';
    if (!raw) return;

    setPreparing(true);
    try {
      const { file, error } = await normalizeIdImageFile(raw);
      if (!file) {
        onError(error ?? 'Could not use that file.');
        return;
      }

      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const renamed = new File([file], `${filePrefix}-${Date.now()}.${ext}`, { type: file.type });
      onCapture(renamed);
    } finally {
      setPreparing(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        className="sr-only"
        onChange={handleChange}
      />
      <button
        type="button"
        disabled={preparing}
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        {preparing ? 'Preparing photo…' : label}
      </button>
    </>
  );
}
