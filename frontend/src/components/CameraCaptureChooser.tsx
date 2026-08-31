interface CameraCaptureChooserProps {
  open: boolean;
  onClose: () => void;
  onChoosePicture: () => void;
  onChooseVideo: () => void;
}

/**
 * First step after tapping the chat camera icon: pick still vs video note,
 * then the real camera opens for that choice (never a file picker).
 */
export function CameraCaptureChooser({
  open,
  onClose,
  onChoosePicture,
  onChooseVideo,
}: CameraCaptureChooserProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
      data-testid="camera-capture-chooser-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Camera"
        data-testid="camera-capture-chooser"
        className="w-full max-w-sm overflow-hidden rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.18em] text-[var(--copper)]">
            Camera
          </p>
          <p className="mt-1 text-center text-sm text-[var(--cream-muted)]">
            Picture or video — then the live camera opens.
          </p>
        </div>

        <div className="flex flex-col gap-2 px-4 pb-3 pt-2">
          <button
            type="button"
            data-testid="camera-choose-picture"
            onClick={onChoosePicture}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--copper)] px-4 py-3.5 text-sm font-bold text-[var(--nn-on-copper)] active:scale-[0.98]"
          >
            Picture
          </button>
          <button
            type="button"
            data-testid="camera-choose-video"
            onClick={onChooseVideo}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3.5 text-sm font-bold text-[var(--cream)] active:scale-[0.98]"
          >
            Video
          </button>
          <button
            type="button"
            data-testid="camera-chooser-cancel"
            onClick={onClose}
            className="mt-1 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--cream-muted)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
