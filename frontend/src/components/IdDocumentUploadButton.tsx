import { useRef } from 'react';
import { normalizeIdImageFile } from '../lib/imageUpload';

interface IdDocumentUploadButtonProps {
  label?: string;
  filePrefix: string;
  onCapture: (file: File) => void;
  onError: (message: string) => void;
  className?: string;
}

/** Pick a JPEG/PNG/WebP from the device instead of using the live camera. */
export function IdDocumentUploadButton({
  label = 'Upload photo from device',
  filePrefix,
  onCapture,
  onError,
  className,
}: IdDocumentUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.files?.[0];
    event.target.value = '';
    if (!raw) return;

    const { file, error } = normalizeIdImageFile(raw);
    if (!file) {
      onError(error ?? 'Could not use that file.');
      return;
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const renamed = new File([file], `${filePrefix}-${Date.now()}.${ext}`, { type: file.type });
    onCapture(renamed);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        {label}
      </button>
    </>
  );
}