import { useEffect, useRef, useState } from 'react';
import type { RoomParticipant } from '../hooks/useRoomVideo';
import {
  attachRemoteAudio,
  attachStreamToVideo,
  ensureInlinePlayback,
  streamHasRenderableVideo,
  videoElementHasFrames,
} from '../lib/callMedia';

interface RoomGalleryGridProps {
  participants: RoomParticipant[];
  pinnedId: string | null;
  onPin: (userId: string | null) => void;
  getStreamFor: (userId: string) => MediaStream | null;
  photoUrl: (url?: string | null) => string | undefined;
  cameraOnForSelf?: boolean;
}

function ParticipantTile({
  participant,
  pinned,
  onPin,
  stream,
  photoUrl,
  showVideo,
}: {
  participant: RoomParticipant;
  pinned: boolean;
  onPin: () => void;
  stream: MediaStream | null;
  photoUrl: string | undefined;
  showVideo: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [framesReady, setFramesReady] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (showVideo && stream) {
      ensureInlinePlayback(el);
      void attachStreamToVideo(el, stream, { preferUnmuted: false }).then(() => {
        if (videoElementHasFrames(el) || streamHasRenderableVideo(stream)) {
          setFramesReady(true);
        }
      });
      if (!participant.isSelf) {
        void attachRemoteAudio(audioRef.current, stream);
      } else if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    } else {
      el.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
      setFramesReady(false);
    }
  }, [stream, showVideo, participant.isSelf]);

  useEffect(() => {
    if (!showVideo || participant.isSelf) return;
    const el = videoRef.current;
    if (!el) return;
    let cancelled = false;
    let raf = 0;
    const tick = () => {
      if (cancelled) return;
      if (videoElementHasFrames(el) || streamHasRenderableVideo(stream)) {
        setFramesReady(true);
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [showVideo, stream, participant.isSelf]);

  const renderVideo = showVideo && (participant.isSelf || framesReady || streamHasRenderableVideo(stream));

  return (
    <button
      type="button"
      onClick={onPin}
      className="relative aspect-[4/5] overflow-hidden rounded-sm bg-[#11100E] text-left transition-all"
      style={{
        border: pinned ? '2px solid #C4832A' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: pinned ? '0 0 0 1px rgba(196,131,42,0.35)' : undefined,
      }}
      aria-label={`${participant.name}${participant.isLive ? ', live' : ''}`}
    >
      {showVideo ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              transform: participant.isSelf ? 'scaleX(-1)' : undefined,
              opacity: renderVideo ? 1 : 0,
            }}
          />
          {!participant.isSelf && (
            <audio ref={audioRef} autoPlay playsInline className="hidden" />
          )}
        </>
      ) : null}

      {(!showVideo || (!participant.isSelf && !renderVideo)) &&
        (photoUrl ? (
          <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-2xl font-black"
            style={{
              background: 'linear-gradient(145deg, #2A1C0A, #0D0A06)',
              color: '#C4832A',
            }}
          >
            {participant.name.slice(0, 2).toUpperCase()}
          </div>
        ))}

      {!participant.isLive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--cream-muted)]">Away</span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-2 pt-8">
        {participant.isMuted && (
          <MicOffIcon className="h-3.5 w-3.5 shrink-0 text-[#EF4444]" />
        )}
        <span className="min-w-0 truncate text-[11px] font-semibold text-white">{participant.name}</span>
        {participant.isLive && (
          <span className="ml-auto shrink-0 rounded bg-[#C4832A] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0D0A06]">
            Live
          </span>
        )}
      </div>
    </button>
  );
}

export function RoomGalleryGrid({
  participants,
  pinnedId,
  onPin,
  getStreamFor,
  photoUrl,
  cameraOnForSelf = true,
}: RoomGalleryGridProps) {
  const live = participants.filter((p) => p.isLive);
  const away = participants.filter((p) => !p.isLive);
  const ordered = [...live, ...away];
  const pinned = pinnedId ? ordered.find((p) => p.user_id === pinnedId) : null;
  const gridItems = pinned ? ordered.filter((p) => p.user_id !== pinnedId) : ordered;

  const tileVideo = (participant: RoomParticipant) => {
    const stream = getStreamFor(participant.user_id);
    if (!stream) return false;
    if (participant.isSelf) return cameraOnForSelf;
    return true;
  };

  if (ordered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <p className="text-sm font-semibold text-[#F0E0C0]">Waiting for people to join</p>
          <p className="mt-1 text-xs text-[var(--cream-muted)]">Share the room — members appear here in the gallery.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 p-1">
      {pinned && (
        <div className="shrink-0 px-1">
          <ParticipantTile
            participant={pinned}
            pinned
            onPin={() => onPin(null)}
            stream={getStreamFor(pinned.user_id)}
            photoUrl={photoUrl(pinned.photo_url)}
            showVideo={tileVideo(pinned)}
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {gridItems.map((participant) => (
            <ParticipantTile
              key={participant.user_id}
              participant={participant}
              pinned={participant.user_id === pinnedId}
              onPin={() => onPin(participant.user_id === pinnedId ? null : participant.user_id)}
              stream={getStreamFor(participant.user_id)}
              photoUrl={photoUrl(participant.photo_url)}
              showVideo={tileVideo(participant)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const MicOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12a7 7 0 0014 0M12 19v3M9 9v3a3 3 0 015.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
  </svg>
);
