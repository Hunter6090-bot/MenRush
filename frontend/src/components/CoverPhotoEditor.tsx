import React, { useCallback, useRef, useState } from 'react';
import { getPhotoUrl } from './UserAvatar';
import {
  coverImageStyle,
  DEFAULT_COVER_FRAME,
  normalizeCoverFrame,
  type CoverFrame,
} from './CoverBanner';

interface CoverPhotoEditorProps {
  coverUrl: string;
  initialFrame?: CoverFrame;
  onSave: (frame: CoverFrame) => Promise<void> | void;
  onCancel: () => void;
}

/** Drag to pan, slider to zoom — framing saved as object-position + scale. */
export function CoverPhotoEditor({
  coverUrl,
  initialFrame = DEFAULT_COVER_FRAME,
  onSave,
  onCancel,
}: CoverPhotoEditorProps) {
  const [frame, setFrame] = useState<CoverFrame>(() =>
    normalizeCoverFrame(initialFrame.x, initialFrame.y, initialFrame.zoom),
  );
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ x: number; y: number; start: CoverFrame } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    const box = frameRef.current;
    if (!box) return;
    const { width, height } = box.getBoundingClientRect();
    if (!width || !height) return;

    setFrame((current) => {
      const next = normalizeCoverFrame(
        current.x - (deltaX / width) * 100 * (1.1 / current.zoom),
        current.y - (deltaY / height) * 100 * (1.1 / current.zoom),
        current.zoom,
      );
      return next;
    });
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, start: frame };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    panBy(event.clientX - dragRef.current.x, event.clientY - dragRef.current.y);
    dragRef.current = { ...dragRef.current, x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: React.PointerEvent) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const nudge = (dx: number, dy: number) => {
    setFrame((current) =>
      normalizeCoverFrame(current.x + dx, current.y + dy, current.zoom),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(frame);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center px-0 sm:px-4 py-0 sm:py-8"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
      data-testid="cover-photo-editor"
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#3D2B0E] bg-[#1E1508] shadow-2xl overflow-hidden"
      >
        <div className="px-5 pt-5 pb-3 border-b border-[#3D2B0E]">
          <h2 className="text-lg font-bold text-[#F0E0C0]">Adjust cover photo</h2>
          <p className="text-xs text-[#A89070] mt-1">
            Drag to move · use the slider to zoom in or out
          </p>
        </div>

        <div
          ref={frameRef}
          className="relative h-44 sm:h-40 overflow-hidden touch-none cursor-grab active:cursor-grabbing bg-[#0D0A06]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            src={getPhotoUrl(coverUrl)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover select-none"
            style={coverImageStyle(frame)}
            draggable={false}
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[#C4832A]/20" />
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto">
            <span />
            <button
              type="button"
              aria-label="Move cover up"
              onClick={() => nudge(0, -4)}
              className="h-10 rounded-xl border border-[#3D2B0E] text-[#F0E0C0] hover:border-[#C4832A]/40"
            >
              ↑
            </button>
            <span />
            <button
              type="button"
              aria-label="Move cover left"
              onClick={() => nudge(-4, 0)}
              className="h-10 rounded-xl border border-[#3D2B0E] text-[#F0E0C0] hover:border-[#C4832A]/40"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Reset cover framing"
              onClick={() => setFrame(DEFAULT_COVER_FRAME)}
              className="h-10 rounded-xl border border-[#3D2B0E] text-[10px] font-bold uppercase tracking-wide text-[#A89070] hover:border-[#C4832A]/40"
            >
              Reset
            </button>
            <button
              type="button"
              aria-label="Move cover right"
              onClick={() => nudge(4, 0)}
              className="h-10 rounded-xl border border-[#3D2B0E] text-[#F0E0C0] hover:border-[#C4832A]/40"
            >
              →
            </button>
            <span />
            <button
              type="button"
              aria-label="Move cover down"
              onClick={() => nudge(0, 4)}
              className="h-10 rounded-xl border border-[#3D2B0E] text-[#F0E0C0] hover:border-[#C4832A]/40"
            >
              ↓
            </button>
            <span />
          </div>

          <label className="block">
            <div className="flex items-center justify-between text-xs text-[#A89070] mb-2">
              <span>Zoom</span>
              <span>{frame.zoom.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={frame.zoom}
              onChange={(e) =>
                setFrame((current) =>
                  normalizeCoverFrame(current.x, current.y, Number(e.target.value)),
                )
              }
              className="w-full accent-[#C4832A]"
            />
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 h-11 rounded-xl border border-[#3D2B0E] text-sm font-semibold text-[#F0E0C0]/80 hover:border-[#C4832A]/30"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex-1 h-11 rounded-xl bg-[#C4832A] text-sm font-semibold text-[#0D0A06] hover:brightness-110 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save framing'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
