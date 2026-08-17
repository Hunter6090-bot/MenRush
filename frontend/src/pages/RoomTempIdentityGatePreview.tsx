import { useEffect, useMemo, useState } from 'react';
import { roomsAPI } from '../api/client';
import { RoomTempIdentityGate } from '../components/RoomTempIdentityGate';

type PreviewState = 'first' | 'saved' | 'error';

/**
 * DEV-only visual harness for the 1a room temp identity gate.
 * Route: /dev/room-temp-gate
 */
export function RoomTempIdentityGatePreview() {
  const [state, setState] = useState<PreviewState>('first');
  const [ready, setReady] = useState(false);
  const [lastPayload, setLastPayload] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const key = useMemo(() => `preview-${state}`, [state]);

  useEffect(() => {
    setReady(false);
    const originalGet = roomsAPI.getTempIdentity;
    const originalDelete = roomsAPI.deleteTempIdentity;
    const originalUpload = roomsAPI.uploadTempPhoto;

    roomsAPI.getTempIdentity = async (roomId: string) => {
      if (roomId === 'preview-saved') {
        return {
          data: {
            display_name: 'Gear Bear',
            photo_url: null,
            save_name: true,
            save_photo: true,
          },
        } as never;
      }
      return { data: {} } as never;
    };
    roomsAPI.deleteTempIdentity = async () => ({ data: { deleted: true } }) as never;
    roomsAPI.uploadTempPhoto = async () =>
      ({ data: { photo_url: '/brand/medallion-380.png' } }) as never;

    setReady(true);
    return () => {
      roomsAPI.getTempIdentity = originalGet;
      roomsAPI.deleteTempIdentity = originalDelete;
      roomsAPI.uploadTempPhoto = originalUpload;
    };
  }, [state]);

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--bg-primary)', color: 'var(--cream)' }}
      data-testid="room-temp-gate-preview"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-default)] px-4 py-3">
        <p className="mr-2 text-[12px] font-bold uppercase tracking-wide text-[#C4832A]">
          Gate preview
        </p>
        {(['first', 'saved', 'error'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setState(s);
              setCancelled(false);
              setLastPayload('');
            }}
            className="rounded-full border border-[rgba(196,131,42,0.35)] px-3 py-1 text-[12px] font-semibold"
            style={{
              background: state === s ? 'rgba(196,131,42,0.25)' : 'transparent',
              color: state === s ? '#C4832A' : '#A89070',
            }}
          >
            {s === 'first' ? 'First entry' : s === 'saved' ? 'Saved identity' : 'Force error path'}
          </button>
        ))}
      </div>

      {cancelled ? (
        <p className="p-6 text-sm text-[#A89070]">Not now → onCancel fired.</p>
      ) : ready ? (
        <RoomTempIdentityGate
          key={key}
          roomId={state === 'saved' ? 'preview-saved' : 'preview-first'}
          roomName={state === 'saved' ? 'Leather & Gear' : 'Bears & Cubs'}
          roomDescription="A friendly space for bears, cubs and otters."
          roomTheme={state === 'saved' ? 'Leather & Gear' : 'Bears & Cubs'}
          activeCount={12}
          onReady={async (identity) => {
            if (state === 'error') {
              throw new Error('forced');
            }
            setLastPayload(JSON.stringify(identity, null, 2));
          }}
          onCancel={() => setCancelled(true)}
        />
      ) : null}

      {lastPayload ? (
        <pre className="border-t border-[var(--border-default)] p-4 text-[11px] text-[#A89070]">
          {lastPayload}
        </pre>
      ) : null}
    </div>
  );
}
