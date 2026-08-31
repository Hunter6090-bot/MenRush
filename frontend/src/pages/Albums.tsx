import React, { useEffect, useRef, useState } from 'react';
import {
  albumsAPI,
  AlbumDTO,
  AlbumViewerDTO,
  LibraryPhotoDTO,
  PhotoVisibility,
} from '../api/client';
import { Layout } from '../components/Layout';
import { AlbumViewerSheet } from '../components/AlbumViewerSheet';
import { SoftBlurMedia, shouldBlurMedia } from '../components/SoftBlurMedia';
import { getPhotoUrl, UserAvatar } from '../components/UserAvatar';
import { useAuthStore } from '../hooks/store';

type GridTile =
  | { kind: 'photo'; photo: LibraryPhotoDTO }
  | { kind: 'private_album'; count: number }
  | { kind: 'add' };

/**
 * My Photos — the person's photos, public. They decide who sees what.
 *
 * Four album states: Public · View once (blurred until opened) · Private album · Add photo.
 * Revoke is VIEWERS ONLY — never a media wipe. Photos stay on the owner's album.
 * Do not flip DISCREET_MEDIA_BLUR; view-once blur is per-photo discretion.
 */
export const Albums = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const userName = useAuthStore((s) => s.user?.name) ?? 'You';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publicPhotos, setPublicPhotos] = useState<LibraryPhotoDTO[]>([]);
  const [viewOncePhotos, setViewOncePhotos] = useState<LibraryPhotoDTO[]>([]);
  const [privatePhotos, setPrivatePhotos] = useState<LibraryPhotoDTO[]>([]);
  const [privateAlbum, setPrivateAlbum] = useState<AlbumDTO | null>(null);
  const [viewers, setViewers] = useState<AlbumViewerDTO[]>([]);
  const [photoTotal, setPhotoTotal] = useState(0);
  const [freeCap, setFreeCap] = useState(6);
  const [selected, setSelected] = useState<AlbumDTO | null>(null);
  const [uploading, setUploading] = useState(false);
  const [addVisibility, setAddVisibility] = useState<PhotoVisibility | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokedSummary, setRevokedSummary] = useState<string | null>(null);
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ url: string; blur: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLibrary = async () => {
    try {
      const res = await albumsAPI.listMine();
      const data = res.data;
      setPublicPhotos(data.public_photos ?? []);
      setViewOncePhotos(data.view_once_photos ?? []);
      setPrivatePhotos(data.private_photos ?? []);
      setPrivateAlbum(data.private_album ?? null);
      setViewers(data.viewers ?? []);
      setPhotoTotal(data.photo_total ?? 0);
      setFreeCap(data.free_cap ?? 6);
      setError('');
      if ((data.viewers ?? []).length > 0) {
        setRevokedSummary(null);
      }
    } catch {
      setError('Could not load your photos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLibrary();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(id);
  }, [notice]);

  const tiles: GridTile[] = [];
  for (const photo of publicPhotos) {
    tiles.push({ kind: 'photo', photo });
  }
  for (const photo of viewOncePhotos) {
    tiles.push({ kind: 'photo', photo });
  }
  tiles.push({ kind: 'private_album', count: privatePhotos.length });
  tiles.push({ kind: 'add' });

  const handleFile = async (file?: File) => {
    if (!file || !addVisibility) {
      setAddVisibility(null);
      return;
    }
    const albumId = privateAlbum?.id;
    if (!albumId) {
      setError('Private album is not ready yet.');
      setAddVisibility(null);
      return;
    }
    setUploading(true);
    setError('');
    try {
      await albumsAPI.upload(albumId, file, addVisibility);
      setNotice(
        addVisibility === 'public'
          ? 'Public photo added.'
          : addVisibility === 'view_once'
            ? 'View-once photo added.'
            : 'Private photo added.',
      );
      await loadLibrary();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Could not upload that photo.',
      );
    } finally {
      setUploading(false);
      setAddVisibility(null);
    }
  };

  const handleOpenPhoto = async (photo: LibraryPhotoDTO) => {
    const url = getPhotoUrl(photo.photo_url) ?? photo.photo_url;
    if (photo.visibility === 'view_once') {
      setOpenedIds((prev) => new Set(prev).add(photo.id));
      setLightbox({ url, blur: false });
      try {
        await albumsAPI.openPhoto(photo.id);
      } catch {
        /* preview still works locally */
      }
      return;
    }
    setLightbox({
      url,
      blur: shouldBlurMedia(photo.media_clear),
    });
  };

  const handleRevokeAll = async () => {
    if (!privateAlbum) return;
    if (viewers.length === 0) return;
    if (
      !window.confirm(
        `Remove access for ${viewers.length} ${viewers.length === 1 ? 'viewer' : 'viewers'}? Your photos stay in your album.`,
      )
    ) {
      return;
    }
    setRevoking(true);
    setError('');
    try {
      const res = await albumsAPI.revokeAll(privateAlbum.id);
      const removed = res.data.viewers_removed;
      const photosLeft = res.data.photo_count;
      setRevokedSummary(
        `Access revoked. ${removed} ${removed === 1 ? 'viewer' : 'viewers'} removed.`,
      );
      setViewers([]);
      setNotice(`Access revoked. ${photosLeft} photo${photosLeft === 1 ? '' : 's'} still yours.`);
      await loadLibrary();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Could not revoke access.',
      );
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6" data-testid="my-photos-page">
        <header>
          <h1 className="text-2xl font-black uppercase tracking-[0.04em] text-[var(--cream)]">
            My Photos
          </h1>
          <p className="mt-1 text-sm text-[var(--cream-muted)]">You decide who sees what.</p>
        </header>

        {error && (
          <div
            className="rounded-2xl border border-[#A45E18]/40 bg-[var(--bg-card)] p-4 text-sm text-[var(--cream)]"
            role="alert"
          >
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-2xl border border-[#8FC773]/30 bg-[#8FC773]/10 p-4 text-sm text-[#8FC773]">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-sm text-[var(--cream-muted)]">
            Loading your photos…
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-2 gap-3"
              data-testid="my-photos-grid"
              aria-label="Your photos"
            >
              {tiles.map((tile, index) => {
                if (tile.kind === 'photo') {
                  const photo = tile.photo;
                  const opened = openedIds.has(photo.id);
                  const blur =
                    photo.visibility === 'view_once' && !opened
                      ? true
                      : shouldBlurMedia(photo.media_clear) && !opened;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      data-testid={`my-photos-tile-${photo.visibility}`}
                      data-visibility={photo.visibility}
                      data-blurred={blur ? '1' : '0'}
                      onClick={() => void handleOpenPhoto(photo)}
                      className="relative aspect-square overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] text-left active:scale-[0.98] transition-transform"
                    >
                      <SoftBlurMedia
                        blurred={blur}
                        className="h-full w-full"
                        data-testid={blur ? 'view-once-blur' : undefined}
                      >
                        <img
                          src={getPhotoUrl(photo.photo_url)}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </SoftBlurMedia>
                      <span
                        className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${
                          photo.visibility === 'view_once'
                            ? 'bg-black/70 text-[var(--cream)]'
                            : 'bg-[#C4832A] text-[#0D0A06]'
                        }`}
                      >
                        {photo.visibility === 'view_once' ? (
                          <span className="inline-flex items-center gap-1">
                            <EyeIcon className="h-3 w-3" />
                            View once
                          </span>
                        ) : (
                          'Public'
                        )}
                      </span>
                    </button>
                  );
                }

                if (tile.kind === 'private_album') {
                  return (
                    <button
                      key="private-album"
                      type="button"
                      data-testid="my-photos-private-album"
                      onClick={() => privateAlbum && setSelected(privateAlbum)}
                      className="relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-[#C4832A]/35 bg-[#C4832A]/18 text-center active:scale-[0.98] transition-transform"
                    >
                      <LockIcon className="h-8 w-8 text-[#C4832A]" />
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#C4832A]">
                        Private album · {tile.count}
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={`add-${index}`}
                    type="button"
                    data-testid="my-photos-add"
                    disabled={uploading}
                    onClick={() => setChooserOpen(true)}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#C4832A]/45 bg-transparent text-[#C4832A] active:scale-[0.98] transition-transform disabled:opacity-60"
                  >
                    <span className="text-2xl font-light leading-none">+</span>
                    <span className="text-sm font-semibold">
                      {uploading ? 'Uploading…' : 'Add photo'}
                    </span>
                  </button>
                );
              })}
            </div>

            <section
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3"
              data-testid="private-album-access"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C4832A]">
                Private album access
              </p>

              {revokedSummary && viewers.length === 0 ? (
                <>
                  <p
                    className="text-sm font-semibold text-[#C4832A]"
                    data-testid="access-revoked-status"
                  >
                    {revokedSummary}
                  </p>
                  <button
                    type="button"
                    disabled
                    data-testid="revoke-all-btn"
                    className="w-full rounded-full border border-[var(--border-default)] py-3 text-sm font-black uppercase tracking-[0.1em] text-[var(--cream-muted)]/50"
                  >
                    Revoked
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {viewers.slice(0, 5).map((viewer) => (
                        <UserAvatar
                          key={viewer.id}
                          name={viewer.name}
                          photoUrl={viewer.photo_url ?? undefined}
                          size="sm"
                          showStatus={false}
                          className="ring-2 ring-[var(--bg-card)]"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-[var(--cream)]" data-testid="viewer-count">
                      {viewers.length === 0
                        ? 'No one has access yet'
                        : `${viewers.length} ${viewers.length === 1 ? 'man can view' : 'men can view'}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="revoke-all-btn"
                    disabled={revoking || viewers.length === 0 || !privateAlbum}
                    onClick={() => void handleRevokeAll()}
                    className="w-full rounded-full border border-[#C4832A] py-3 text-sm font-black uppercase tracking-[0.1em] text-[#C4832A] disabled:opacity-40 hover:bg-[#C4832A]/10 transition-colors"
                  >
                    {revoking ? 'Revoking…' : 'Revoke all access'}
                  </button>
                </>
              )}
            </section>

            <p className="text-center text-[11px] leading-relaxed text-[var(--cream-muted)]/80 px-2">
              Photos stay yours. View-once expires after opening. Revoking removes viewers only —
              your album is unchanged.
            </p>

            {photoTotal > 0 && (
              <p className="text-center text-[11px] text-[var(--cream-muted)]/60">
                {photoTotal}/{freeCap} free photos used
              </p>
            )}
          </>
        )}
      </div>

      {chooserOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center px-0 sm:px-4"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
          onClick={() => setChooserOpen(false)}
          data-testid="add-photo-chooser"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-photo-title"
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border p-5 space-y-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-photo-title" className="text-lg font-bold text-[var(--cream)]">
              Add photo
            </h2>
            <p className="text-sm text-[var(--cream-muted)]">You decide who sees what.</p>
            {(
              [
                { v: 'public' as const, label: 'Public', hint: 'On your profile' },
                { v: 'view_once' as const, label: 'View once', hint: 'Blurred until opened' },
                { v: 'private' as const, label: 'Private album', hint: 'Only men you grant' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                data-testid={`add-visibility-${opt.v}`}
                onClick={() => {
                  setChooserOpen(false);
                  setAddVisibility(opt.v);
                  window.setTimeout(() => fileInputRef.current?.click(), 50);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--border-default)] px-4 py-3 text-left hover:border-[#C4832A]/40"
              >
                <span className="text-sm font-semibold text-[var(--cream)]">{opt.label}</span>
                <span className="text-xs text-[var(--cream-muted)]">{opt.hint}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setChooserOpen(false)}
              className="w-full py-2 text-sm text-[var(--cream-muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        data-testid="my-photos-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          void handleFile(file);
          event.currentTarget.value = '';
        }}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/95 p-4"
          data-testid="my-photos-lightbox"
          onClick={() => setLightbox(null)}
        >
          <SoftBlurMedia blurred={lightbox.blur}>
            <img src={lightbox.url} alt="" className="max-h-full max-w-full object-contain" />
          </SoftBlurMedia>
        </div>
      )}

      {selected && userId && (
        <AlbumViewerSheet
          album={selected}
          mode="owner"
          ownerId={userId}
          ownerName={userName}
          onClose={() => {
            setSelected(null);
            void loadLibrary();
          }}
          onNotice={(msg) => setNotice(msg)}
          onAlbumDeleted={() => {
            setSelected(null);
            void loadLibrary();
          }}
          onPhotosChanged={() => void loadLibrary()}
        />
      )}
    </Layout>
  );
};

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);
