import React, { useEffect, useState } from 'react';
import { albumsAPI, AlbumDTO } from '../api/client';
import { Layout } from '../components/Layout';

export const Albums = () => {
  const [albums, setAlbums] = useState<AlbumDTO[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAlbums = async () => {
    try {
      const res = await albumsAPI.listMine();
      setAlbums(res.data.albums);
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

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4832A]">Private sharing</p>
          <h1 className="text-2xl font-bold text-[#F0E0C0]">Albums</h1>
          <p className="mt-1 text-sm text-[#A89070]">
            Keep photos grouped and share access profile by profile.
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
          <div className="rounded-2xl border border-[#8B4513]/40 bg-[#1E1508] p-4 text-sm text-[#F0E0C0]">
            {error}
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
              <div
                key={album.id}
                className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-5 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#F0E0C0]">{album.name}</h2>
                    <p className="mt-1 text-sm text-[#A89070]">
                      {album.photo_count} {album.photo_count === 1 ? 'photo' : 'photos'}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#C4832A]/25 bg-[#C4832A]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#C4832A]">
                    {album.is_locked ? 'Locked' : 'Open'}
                  </span>
                </div>
                {album.description && (
                  <p className="mt-3 text-sm text-[#F0E0C0]/75">{album.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
