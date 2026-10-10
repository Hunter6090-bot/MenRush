import React, { useEffect, useMemo, useState } from 'react';
import {
  albumsAPI,
  LibraryPhotoDTO,
  MyPhotosLibraryDTO,
} from '../api/client';
import { getPhotoUrl } from './UserAvatar';
import { SoftBlurMedia, shouldBlurMedia } from './SoftBlurMedia';
import {
  AttachPickerModel,
  buildAttachPickerModel,
  mergeAttachSelection,
} from '../lib/chatAttachLibrary';

interface ChatAttachLibrarySheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (photos: LibraryPhotoDTO[]) => void;
  onDeviceGallery: () => void;
}

/**
 * Attach sheet for 1:1 chat — My Photos albums + contents.
 * Default grid: Public + View once. Private only after opening Private and tapping.
 */
export function ChatAttachLibrarySheet({
  open,
  onClose,
  onConfirm,
  onDeviceGallery,
}: ChatAttachLibrarySheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [library, setLibrary] = useState<MyPhotosLibraryDTO | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [privateOpen, setPrivateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setPrivateOpen(false);
    setError('');
    setLoading(true);
    void albumsAPI
      .listMine()
      .then((res) => setLibrary(res.data))
      .catch(() => setError('Could not load My Photos.'))
      .finally(() => setLoading(false));
  }, [open]);

  const model: AttachPickerModel | null = useMemo(
    () => (library ? buildAttachPickerModel(library) : null),
    [library],
  );

  const photoById = useMemo(() => {
    const map = new Map<string, LibraryPhotoDTO>();
    if (!library) return map;
    for (const p of [
      ...(library.public_photos ?? []),
      ...(library.view_once_photos ?? []),
      ...(library.private_photos ?? []),
    ]) {
      map.set(p.id, p);
    }
    return map;
  }, [library]);

  if (!open) return null;

  const togglePhoto = (photo: LibraryPhotoDTO) => {
    const isPrivate = photo.visibility === 'private';
    setSelectedIds((prev) =>
      mergeAttachSelection(prev, photo.id, {
        isPrivate,
        privateSectionOpen: privateOpen,
      }),
    );
  };

  const handleConfirm = () => {
    const photos = selectedIds
      .map((id) => photoById.get(id))
      .filter((p): p is LibraryPhotoDTO => !!p);
    if (photos.length === 0) return;
    onConfirm(photos);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
      data-testid="chat-attach-library-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Attach from My Photos"
        data-testid="chat-attach-library-sheet"
        className="flex max-h-[88vh] w-full max-w-lg min-w-0 flex-col overflow-hidden overflow-x-clip rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.18em] text-[var(--copper)]">
            My Photos
          </p>
          <p className="mt-1 text-center text-sm text-[var(--cream-muted)]">
            Pick what goes in the message. Private stays private unless you open it.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          {loading && (
            <p className="py-8 text-center text-sm text-[var(--cream-muted)]" data-testid="chat-attach-loading">
              Loading your photos…
            </p>
          )}
          {error && (
            <p className="py-4 text-center text-sm text-[var(--cream)]" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && model && (
            <div className="space-y-5" data-testid="chat-attach-default-grid">
              {model.defaultSections.length === 0 && (
                <p className="py-4 text-center text-sm text-[var(--cream-muted)]">
                  No public or view-once photos yet. Use device gallery, or add photos in My Photos.
                </p>
              )}
              {model.defaultSections.map((section) => (
                <section key={section.albumId} data-testid={`chat-attach-album-${section.albumId}`}>
                  <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--copper)]">
                    {section.name}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {section.photos.map((photo) => (
                      <PhotoTile
                        key={photo.id}
                        photo={photo}
                        selected={selectedIds.includes(photo.id)}
                        onToggle={() => togglePhoto(photo)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {model.privateSection && (
                <section data-testid="chat-attach-private-section">
                  <button
                    type="button"
                    data-testid="chat-attach-private-toggle"
                    aria-expanded={privateOpen}
                    onClick={() => setPrivateOpen((v) => !v)}
                    className="flex w-full items-center justify-between rounded-2xl border border-[#C4832A]/35 bg-[#C4832A]/12 px-3 py-3 text-left active:scale-[0.99]"
                  >
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#C4832A]">
                      Private · {model.privateSection.count}
                    </span>
                    <span className="text-xs text-[var(--cream-muted)]">
                      {privateOpen ? 'Hide' : 'Open to pick'}
                    </span>
                  </button>
                  {privateOpen && (
                    <div
                      className="mt-2 grid grid-cols-3 gap-2"
                      data-testid="chat-attach-private-grid"
                    >
                      {model.privateSection.photos.length === 0 ? (
                        <p className="col-span-3 py-3 text-center text-xs text-[var(--cream-muted)]">
                          No private photos.
                        </p>
                      ) : (
                        model.privateSection.photos.map((photo) => (
                          <PhotoTile
                            key={photo.id}
                            photo={photo}
                            selected={selectedIds.includes(photo.id)}
                            onToggle={() => togglePhoto(photo)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border-default)] px-4 py-3">
          <button
            type="button"
            data-testid="chat-attach-device-gallery"
            onClick={onDeviceGallery}
            className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--cream)] active:scale-[0.98]"
          >
            Device gallery
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="chat-attach-cancel"
              onClick={onClose}
              className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--cream-muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="chat-attach-confirm"
              disabled={selectedIds.length === 0}
              onClick={handleConfirm}
              className="flex-1 rounded-2xl bg-[var(--copper)] px-4 py-3 text-sm font-bold text-[var(--nn-on-copper)] active:scale-[0.98] disabled:opacity-40"
            >
              Attach{selectedIds.length > 0 ? ` · ${selectedIds.length}` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoTile({
  photo,
  selected,
  onToggle,
}: {
  photo: LibraryPhotoDTO;
  selected: boolean;
  onToggle: () => void;
}) {
  const blur =
    photo.visibility === 'view_once'
      ? true
      : shouldBlurMedia(photo.media_clear);

  return (
    <button
      type="button"
      data-testid={`chat-attach-photo-${photo.visibility}`}
      data-photo-id={photo.id}
      data-visibility={photo.visibility}
      data-selected={selected ? '1' : '0'}
      aria-pressed={selected}
      onClick={onToggle}
      className="relative aspect-square overflow-hidden rounded-xl border text-left active:scale-[0.98]"
      style={{
        borderColor: selected ? '#C4832A' : 'var(--border-default)',
        boxShadow: selected ? '0 0 0 2px rgba(196,131,42,0.45)' : undefined,
      }}
    >
      <SoftBlurMedia blurred={blur && photo.visibility === 'view_once'} className="h-full w-full">
        <img
          src={getPhotoUrl(photo.photo_url)}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </SoftBlurMedia>
      <span
        className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.06em] ${
          photo.visibility === 'private'
            ? 'bg-black/75 text-[#C4832A]'
            : photo.visibility === 'view_once'
              ? 'bg-black/70 text-[var(--cream)]'
              : 'bg-[#C4832A] text-[#0D0A06]'
        }`}
      >
        {photo.visibility === 'view_once'
          ? 'Once'
          : photo.visibility === 'private'
            ? 'Private'
            : 'Public'}
      </span>
      {selected && (
        <span
          className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
          style={{ background: '#C4832A', color: '#0D0A06' }}
          aria-hidden
        >
          ✓
        </span>
      )}
    </button>
  );
}
