import React, { useEffect, useState } from 'react';
import { albumsAPI, AlbumDTO } from '../api/client';
import { Layout } from '../components/Layout';
import { AlbumCard, AlbumViewerSheet } from '../components/AlbumViewerSheet';
import { useAuthStore } from '../hooks/store';

export const Albums = () => {
  const userId = useAuthStore((s) => s.user?.id);
  const userName = useAuthStore((s) => s.user?.name) ?? 'You';
  const [albums, setAlbums] = useState<AlbumDTO[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAlbumId, setUploadingAlbumId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<AlbumDTO | null>(null);
  const [photoTotal, setPhotoTotal] = useState(0);
  const [freeCap, setFreeCap] = useState(6);

  const loadAlbums = async () => {
    try {
      const res = await albumsAPI.listMine();
      setAlbums(res.data.albums);
      setPhotoTotal(res.data.photo_total);
      setFreeCap(res.data.free_cap);
      setError('');
    } catch {
      setError('Could not load your albums.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlbums();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(id);
  }, [notice]);

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await albumsAPI.create({ name: name.trim(), is_locked: true });
      setName('');
      await loadAlbums();
    } catch {
      setError('Could not create that album.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (albumId: string, file?: File) => {
    if (!file) return;
    setUploadingAlbumId(albumId);
    setError('');
    try {
      await albumsAPI.upload(albumId, file);
      await loadAlbums();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Could not upload that photo.',
      );
    } finally {
      setUploadingAlbumId(null);
    }
  };

  const handleDeleteAlbum = async (album: AlbumDTO) => {
    if (
      !window.confirm(
        `Delete "${album.name}" and all ${album.photo_count} photo${album.photo_count === 1 ? '' : 's'}? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await albumsAPI.remove(album.id);
      if (selected?.id === album.id) setSelected(null);
      setNotice('Album deleted.');
      await loadAlbums();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Could not delete album.',
      );
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4832A]">Private sharing</p>
          <h1 className="text-2xl font-bold text-[#F0E0C0]">Albums</h1>
          <p className="mt-1 text-sm text-[#A89070]">
            {photoTotal}/{freeCap} free photos used. Tap an album to view photos and grant access.
          </p>
        </div>

        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-5 shadow-card"
        >
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#F0E0C0]/85">
            New album
          </label>
          <div className="mt-3 flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekend, Travel, Favourites..."
              className="flex-1 rounded-xl border border-[#3D2B0E] bg-[#0D0A06] px-4 py-3 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/50 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/40"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#C4832A] px-4 py-3 text-sm font-bold text-[#0D0A06] disabled:opacity-60"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-2xl border border-[#A45E18]/40 bg-[#1E1508] p-4 text-sm text-[#F0E0C0]">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-2xl border border-[#8FC773]/30 bg-[#8FC773]/10 p-4 text-sm text-[#8FC773]">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-5 text-sm text-[#A89070]">
            Loading albums…
          </div>
        ) : albums.length === 0 ? (
          <div className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-5 text-sm text-[#A89070]">
            No albums yet. Create one above to start building your private library.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {albums.map((album) => (
              <div key={album.id} className="space-y-3">
                <AlbumCard
                  album={album}
                  onOpen={() => setSelected(album)}
                  onDelete={() => void handleDeleteAlbum(album)}
                />
                <div>
                  <input
                    id={`album-upload-${album.id}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploadingAlbumId === album.id}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void handleUpload(album.id, file);
                      event.currentTarget.value = '';
                    }}
                  />
                  <label
                    htmlFor={`album-upload-${album.id}`}
                    className={`inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#C4832A]/35 bg-[#C4832A]/10 px-3.5 py-2 text-sm font-bold text-[#C4832A] transition-colors hover:bg-[#C4832A]/18 ${
                      uploadingAlbumId === album.id ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    {uploadingAlbumId === album.id ? 'Uploading...' : 'Upload photo'}
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && userId && (
        <AlbumViewerSheet
          album={selected}
          mode="owner"
          ownerId={userId}
          ownerName={userName}
          onClose={() => {
            setSelected(null);
            void loadAlbums();
          }}
          onNotice={(msg) => setNotice(msg)}
          onAlbumDeleted={() => {
            setSelected(null);
            void loadAlbums();
          }}
          onPhotosChanged={() => void loadAlbums()}
        />
      )}
    </Layout>
  );
};
