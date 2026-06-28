import React, { useEffect, useState } from 'react';
import { albumsAPI, AlbumDTO } from '../api/client';
import { AlbumCard, AlbumViewerSheet } from './AlbumViewerSheet';

interface ProfileAlbumsSectionProps {
  ownerId: string;
  ownerName: string;
}

export function ProfileAlbumsSection({ ownerId, ownerName }: ProfileAlbumsSectionProps) {
  const [albums, setAlbums] = useState<AlbumDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AlbumDTO | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    albumsAPI
      .listForUser(ownerId)
      .then((res) => setAlbums(res.data.albums ?? []))
      .catch(() => setAlbums([]))
      .finally(() => setLoading(false));
  }, [ownerId]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(id);
  }, [notice]);

  if (loading) return null;
  if (albums.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4832A]">Albums</p>
        <p className="text-xs text-[#A89070] mt-0.5">Tap an album to view or request access.</p>
      </div>

      {notice && (
        <p className="rounded-xl border border-[#3D2B0E] bg-[#0D0A06]/80 px-3 py-2 text-xs text-[#F0E0C0]">
          {notice}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} onOpen={() => setSelected(album)} />
        ))}
      </div>

      {selected && (
        <AlbumViewerSheet
          album={selected}
          mode="viewer"
          ownerId={ownerId}
          ownerName={ownerName}
          onClose={() => setSelected(null)}
          onNotice={(msg) => setNotice(msg)}
        />
      )}
    </section>
  );
}
