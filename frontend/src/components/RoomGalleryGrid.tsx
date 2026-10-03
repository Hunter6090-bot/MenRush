import { useEffect, useRef, useState } from 'react';
import type { RoomParticipant } from '../hooks/useRoomVideo';
import { roomLetterAvatar } from '../lib/roomLetterAvatar';
import {
  attachRemoteAudio,
  attachStreamToVideo,
  detachStreamFromVideo,
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

/** Column count follows occupancy so one face is not a postage stamp in a 6-col grid. */
export function galleryGridClass(count: number): string {
  const gap = 'gap-1.5 sm:gap-2';
  if (count <= 1) return `grid h-full min-h-0 grid-cols-1 ${gap}`;
  if (count === 2) return `grid h-full min-h-0 grid-cols-1 sm:grid-cols-2 ${gap}`;
  if (count <= 4) return `grid h-full min-h-0 grid-cols-2 ${gap}`;
  if (count <= 9) return `grid min-h-0 auto-rows-fr grid-cols-2 content-start sm:grid-cols-3 ${gap}`;
  return `grid min-h-0 auto-rows-fr grid-cols-2 content-start sm:grid-cols-3 lg:grid-cols-4 ${gap}`;
}

export function galleryTilesFillStage(count: number): boolean {
  return count > 0 && count <= 4;
}

function ParticipantTile({
  participant,
  pinned,
  fill,
  onPin,
  stream,
  photoUrl,
  showVideo,
}: {
  participant: RoomParticipant;
  pinned: boolean;
  fill: boolean;
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
      detachStreamFromVideo(el);
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          /* ignore */
        }
        audioRef.current.srcObject = null;
      }
      setFramesReady(false);
    }

    return () => {
      detachStreamFromVideo(el);
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          /* ignore */
        }
        audioRef.current.srcObject = null;
      }
    };
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
      className={`group relative overflow-hidden rounded-sm bg-[#11100E] text-left transition-all ${
        pinned || fill ? 'h-full min-h-0 w-full' : 'w-full aspect-[4/5]'
      }`}
      style={{
        border: pinned ? '2px solid #C4832A' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: pinned ? '0 0 0 1px rgba(196,131,42,0.35)' : undefined,
      }}
      aria-label={`${participant.name}${participant.isLive ? ', live' : ''}${
        pinned ? ', focused. Click to unfocus' : '. Click to focus'
      }`}
    >
      {pinned ? (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded bg-[#C4832A]/90 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[var(--nn-on-copper)] shadow-sm">
          <PinIcon className="h-3 w-3" />
          <span>Focused</span>
        </div>
      ) : null}

      {pinned ? (
        <span
          className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/80"
          title="Unfocus"
        >
          <span>Unpin</span>
          <CloseIcon className="h-3 w-3" />
        </span>
      ) : (
        <span
          className="absolute top-1.5 right-1.5 z-10 hidden rounded bg-black/50 px-1.5 py-0.5 text-[11px] font-semibold text-white/70 backdrop-blur-sm transition-opacity group-hover:block"
          title="Focus video"
        >
          Focus
        </span>
      )}

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
              background: 'linear-gradient(145deg, var(--bg-elevated), var(--bg-primary))',
              color: '#C4832A',
            }}
          >
            {roomLetterAvatar(participant.name)}
          </div>
        ))}

      {!participant.isLive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--cream-muted)]">Away</span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2.5 pb-2.5 pt-8">
        {participant.isMuted && (
          <MicOffIcon className="h-4 w-4 shrink-0 text-[#EF4444]" />
        )}
        <span className="min-w-0 truncate text-sm font-semibold text-white">{participant.name}</span>
        {participant.isLive && (
          <span className="ml-auto shrink-0 rounded bg-[#C4832A] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--nn-on-copper)]">
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
  cameraOnForSelf = false,
}: RoomGalleryGridProps) {
  const live = participants.filter((p) => p.isLive);
  const away = participants.filter((p) => !p.isLive);
  // Occupancy lock: AWAY = camera-off while still in room (not left). Left people are removed.
  const ordered = [...live, ...away];
  const pinned = pinnedId ? ordered.find((p) => p.user_id === pinnedId) : null;
  const gridItems = pinned ? ordered.filter((p) => p.user_id !== pinnedId) : ordered;
  const fillUnpinned = !pinned && galleryTilesFillStage(gridItems.length);

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
          <p className="text-base font-semibold text-[var(--cream)]">Waiting for people</p>
          <p className="mt-1 text-sm text-[var(--cream-muted)]">Share the room. Faces show here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 p-1.5 sm:p-2">
      {pinned && (
        <div
          className={`flex w-full min-h-0 justify-center ${gridItems.length ? 'min-h-[12rem] flex-[3]' : 'flex-1'}`}
          data-testid="room-spotlight-container"
        >
          <div className="relative h-full min-h-[12rem] w-full max-w-5xl">
            <ParticipantTile
              key={pinned.user_id}
              participant={pinned}
              pinned
              fill
              onPin={() => onPin(null)}
              stream={getStreamFor(pinned.user_id)}
              photoUrl={photoUrl(pinned.photo_url)}
              showVideo={tileVideo(pinned)}
            />
          </div>
        </div>
      )}
      {gridItems.length > 0 ? (
        <div
          className={
            pinned
              ? 'max-h-[30%] min-h-[6.5rem] shrink-0 overflow-x-auto sm:max-h-[34%]'
              : 'min-h-0 flex-1 overflow-y-auto'
          }
        >
          <div
            className={
              pinned
                ? 'grid h-full auto-cols-[minmax(7.5rem,12rem)] grid-flow-col gap-1.5 sm:auto-cols-[minmax(9rem,14rem)]'
                : galleryGridClass(gridItems.length)
            }
            data-testid="room-gallery-grid"
            data-tile-count={gridItems.length}
          >
            {gridItems.map((participant) => (
              <ParticipantTile
                key={participant.user_id}
                participant={participant}
                pinned={participant.user_id === pinnedId}
                fill={fillUnpinned || Boolean(pinned)}
                onPin={() => onPin(participant.user_id === pinnedId ? null : participant.user_id)}
                stream={getStreamFor(participant.user_id)}
                photoUrl={photoUrl(participant.photo_url)}
                showVideo={tileVideo(participant)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const PinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v2a2 2 0 01-.586 1.414L16 11v6l-2 2v2h-4v-2l-2-2v-6L5.586 8.414A2 2 0 015 7V5z" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const MicOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12a7 7 0 0014 0M12 19v3M9 9v3a3 3 0 015.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
  </svg>
);
