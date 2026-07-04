import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { albumsAPI, AlbumDTO, AlbumPhotoDTO, usersAPI } from '../api/client';
import { getPhotoUrl } from './UserAvatar';

type SheetMode = 'owner' | 'viewer';

interface MatchRow {
  id: string;
  name: string;
  photo_url?: string;
}

interface AlbumViewerSheetProps {
  album: AlbumDTO;
  mode: SheetMode;
  ownerId: string;
  ownerName: string;
  onClose: () => void;
  onNotice?: (message: string, tone?: 'success' | 'error') => void;
  onAlbumDeleted?: () => void;
  onPhotosChanged?: () => void;
}

export function AlbumViewerSheet({
  album,
  mode,
  ownerId,
  ownerName,
  onClose,
  onNotice,
  onAlbumDeleted,
  onPhotosChanged,
}: AlbumViewerSheetProps) {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<AlbumPhotoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [unlocked, setUnlocked] = useState(true);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isPrivateToViewer = mode === 'viewer' && album.is_locked && !album.unlocked;

  useEffect(() => {
    if (isPrivateToViewer) {
      setLoading(false);
      setLocked(true);
      setUnlocked(false);
      return;
    }

    setLoading(true);
    albumsAPI
      .listPhotos(album.id)
      .then((res) => {
        setPhotos(res.data.photos);
        setLocked(res.data.locked);
        setUnlocked(res.data.unlocked);
      })
      .catch(() => {
        onNotice?.('Could not load album photos.', 'error');
      })
      .finally(() => setLoading(false));
  }, [album.id, isPrivateToViewer, onNotice]);

  useEffect(() => {
    if (mode !== 'owner' || !album.is_locked) return;
    usersAPI
      .getMatches()
      .then((res) => setMatches(res.data ?? []))
      .catch(() => setMatches([]));
  }, [mode, album.is_locked]);

  const handleGrant = async (viewerId: string) => {
    setGrantingId(viewerId);
    try {
      await albumsAPI.grant(album.id, viewerId);
      onNotice?.('Album access granted.', 'success');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not grant access. You need a mutual match.';
      onNotice?.(message, 'error');
    } finally {
      setGrantingId(null);
    }
  };

  const handleDeleteAlbum = async () => {
    if (
      !window.confirm(
        `Delete "${album.name}" and all ${album.photo_count} photo${album.photo_count === 1 ? '' : 's'}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingAlbum(true);
    try {
      await albumsAPI.remove(album.id);
      onNotice?.('Album deleted.', 'success');
      onAlbumDeleted?.();
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not delete album.';
      onNotice?.(message, 'error');
    } finally {
      setDeletingAlbum(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    setDeletingPhotoId(photoId);
    try {
      await albumsAPI.removePhoto(album.id, photoId);
      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
      if (lightboxUrl) setLightboxUrl(null);
      onPhotosChanged?.();
      onNotice?.('Photo removed.', 'success');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not delete photo.';
      onNotice?.(message, 'error');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center px-0 sm:px-4"
        style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="album-sheet-title"
          className="w-full sm:max-w-lg max-h-[88vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border shadow-2xl flex flex-col"
          style={{ background: '#1E1508', borderColor: '#3D2B0E' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#3D2B0E]">
            <div className="min-w-0">
              <h2 id="album-sheet-title" className="text-lg font-bold text-[#F0E0C0] truncate">
                {album.name}
              </h2>
              <p className="text-xs text-[#A89070] mt-0.5">
                {album.photo_count} {album.photo_count === 1 ? 'photo' : 'photos'}
                {album.is_locked ? ' · Locked' : ' · Open'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {mode === 'owner' && (
                <button
                  type="button"
                  onClick={() => void handleDeleteAlbum()}
                  disabled={deletingAlbum}
                  aria-label="Delete album"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EF4444]/40 bg-[#EF4444]/15 text-lg leading-none text-[#EF4444] hover:bg-[#EF4444]/25 disabled:opacity-50"
                >
                  ×
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3D2B0E] text-lg leading-none text-[#A89070] hover:text-[#F0E0C0]"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isPrivateToViewer ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#C4832A]/30 bg-[#C4832A]/10">
                  <LockIcon className="h-8 w-8 text-[#C4832A]" />
                </div>
                <p className="text-sm font-semibold text-[#F0E0C0]">Private album</p>
                <p className="mt-2 text-sm leading-relaxed text-[#A89070] max-w-xs mx-auto">
                  {ownerName} keeps this album locked. Ask in chat if you want access — they can
                  unlock it for you after you match.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/messages/${ownerId}`);
                  }}
                  className="mt-6 w-full rounded-xl bg-[#C4832A] py-3 text-sm font-black text-[#0D0A06]"
                >
                  Message {ownerName}
                </button>
              </div>
            ) : loading ? (
              <p className="py-10 text-center text-sm text-[#A89070]">Loading photos…</p>
            ) : photos.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#A89070]">No photos in this album yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square overflow-hidden rounded-xl border border-[#3D2B0E] bg-[#0D0A06]"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(getPhotoUrl(photo.photo_url) ?? null)}
                      className="h-full w-full active:scale-[0.98] transition-transform"
                    >
                      <img
                        src={getPhotoUrl(photo.photo_url)}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    {mode === 'owner' && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeletePhoto(photo.id);
                        }}
                        disabled={deletingPhotoId === photo.id}
                        aria-label="Delete photo"
                        className="absolute top-1 right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[#EF4444]/35 bg-black/75 text-sm leading-none text-[#EF4444] hover:bg-[#EF4444]/20 disabled:opacity-50"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {mode === 'owner' && album.is_locked && !isPrivateToViewer && (
              <div className="mt-6 rounded-2xl border border-[#3D2B0E] bg-[#0D0A06]/60 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C4832A]">
                  Share access
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#A89070]">
                  Locked albums are hidden until you grant a match access.
                </p>
                {matches.length === 0 ? (
                  <p className="mt-3 text-sm text-[#A89070]">No matches yet to share with.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {matches.map((match) => (
                      <li
                        key={match.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#3D2B0E] px-3 py-2"
                      >
                        <span className="text-sm text-[#F0E0C0] truncate">{match.name}</span>
                        <button
                          type="button"
                          disabled={grantingId === match.id}
                          onClick={() => void handleGrant(match.id)}
                          className="shrink-0 rounded-lg bg-[#C4832A]/15 px-3 py-1.5 text-xs font-bold text-[#C4832A] disabled:opacity-50"
                        >
                          {grantingId === match.id ? 'Granting…' : 'Grant'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {mode === 'viewer' && unlocked && locked && (
              <p className="mt-4 text-center text-xs text-[#8FC773]">You have access to this album.</p>
            )}
          </div>
        </div>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </>
  );
}

export function AlbumCard({
  album,
  onOpen,
  onDelete,
}: {
  album: AlbumDTO;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const lockedForViewer = album.is_locked && album.unlocked === false;
  const cover = getPhotoUrl(album.cover_url ?? undefined);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      data-testid={`album-card-${album.id}`}
      className="relative w-full cursor-pointer rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-4 text-left shadow-card transition-all hover:border-[#C4832A]/40 active:scale-[0.99]"
    >
      {onDelete && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${album.name}`}
          className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[#EF4444]/40 bg-black/80 text-base leading-none text-[#EF4444] shadow-lg hover:bg-[#EF4444]/20"
        >
          ×
        </button>
      )}
      <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-xl border border-[#3D2B0E] bg-[#0D0A06]">
        {cover && !lockedForViewer ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2A1C0A] to-[#0D0A06]">
            <LockIcon className="h-10 w-10 text-[#C4832A]/70" />
          </div>
        )}
        {album.is_locked && album.unlocked !== true && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#F0E0C0]/90">
              {album.unlocked === false ? 'Tap to request access' : 'Tap to open'}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#F0E0C0]">{album.name}</p>
          <p className="mt-0.5 text-xs text-[#A89070]">
            {album.photo_count} {album.photo_count === 1 ? 'photo' : 'photos'}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[#C4832A]/25 bg-[#C4832A]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#C4832A]">
          {album.is_locked ? (album.unlocked ? 'Unlocked' : 'Locked') : 'Open'}
        </span>
      </div>
    </div>
  );
}

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);
