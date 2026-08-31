import { useMemo, useState } from 'react';
import { RoomPresentPeopleList } from '../components/RoomPresentPeopleList';
import { RoomInRoomDm, type InRoomDmMessage } from '../components/RoomInRoomDm';
import {
  presentOthers,
  removePresentPerson,
  replacePresentRoster,
  type PresentPerson,
} from '../lib/roomPresentRoster';

const SELF_ID = 'self-user';

/**
 * Local interactive preview for Al/Zoul in-room 1:1 side list.
 * Route: /dev/room-inroom-dm — no backend required.
 */
export function RoomInRoomDmPreview() {
  const [roster, setRoster] = useState<PresentPerson[]>(() =>
    replacePresentRoster([
      { user_id: SELF_ID, name: 'You (temp)', photo_url: null },
      { user_id: 'peer-fox', name: 'Quiet Fox', photo_url: null },
      { user_id: 'peer-cub', name: 'Cub NW', photo_url: null },
    ]),
  );
  const [dmPeer, setDmPeer] = useState<{
    id: string;
    name: string;
    photo_url?: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<InRoomDmMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const sidePeople = useMemo(() => presentOthers(roster, SELF_ID), [roster]);

  const pushLog = (line: string) => setLog((prev) => [...prev.slice(-8), line]);

  const openDm = (person: PresentPerson) => {
    setDmPeer({ id: person.user_id, name: person.name, photo_url: person.photo_url });
    setMessages([]);
    setNotice(null);
    pushLog(`Opened in-room 1:1 with ${person.name}`);
  };

  const closeDm = () => {
    if (dmPeer) pushLog(`Left 1:1 with ${dmPeer.name}`);
    setDmPeer(null);
    setMessages([]);
    setNotice(null);
  };

  const send = (text: string) => {
    if (!dmPeer) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        sender_id: SELF_ID,
        sender_name: 'You (temp)',
        message: text,
        created_at: new Date().toISOString(),
      },
    ]);
    // Simulate peer reply once.
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `m-peer-${Date.now()}`,
          sender_id: dmPeer.id,
          sender_name: dmPeer.name,
          message: 'Got it — room identity only.',
          created_at: new Date().toISOString(),
        },
      ]);
    }, 400);
  };

  const simulatePeerLeaveGroup = () => {
    if (!dmPeer) {
      pushLog('Open a 1:1 first, then simulate leave');
      return;
    }
    const leaving = dmPeer;
    setRoster((prev) => removePresentPerson(prev, leaving.id));
    setNotice('They left the room — this 1:1 is gone.');
    pushLog(`${leaving.name} left the group → 1:1 deleted`);
    window.setTimeout(() => {
      setDmPeer(null);
      setMessages([]);
      setNotice(null);
    }, 900);
  };

  return (
    <div
      className="min-h-screen text-[var(--cream)]"
      style={{ background: 'var(--bg-primary, #0D0A06)' }}
      data-testid="room-inroom-dm-preview"
    >
      <header className="border-b border-[var(--border-default)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cream-muted)]">
          Dev preview · Video rooms
        </p>
        <h1 className="text-lg font-semibold">In-room 1:1 side list</h1>
        <p className="mt-1 max-w-xl text-xs text-[var(--cream-muted)]">
          Present people only. Tap opens a 1:1 inside the group. Room identity only — no profile
          links. Leave 1:1 or leave group → gone.
        </p>
      </header>

      <div className="flex h-[min(70vh,560px)] border-b border-[var(--border-default)]">
        <div
          className="relative flex min-w-0 flex-1 items-center justify-center"
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, rgba(196,131,42,0.12), transparent 55%), #120e09',
          }}
        >
          <p className="text-sm text-[var(--cream-muted)]">Video gallery (placeholder)</p>
          {dmPeer ? (
            <div className="absolute bottom-3 left-3 right-3 z-10 sm:left-auto sm:right-3 sm:w-[22rem]">
              <RoomInRoomDm
                peerId={dmPeer.id}
                peerName={dmPeer.name}
                peerPhotoUrl={dmPeer.photo_url}
                selfId={SELF_ID}
                messages={messages}
                onSend={send}
                onClose={closeDm}
                notice={notice}
              />
            </div>
          ) : null}
        </div>
        <RoomPresentPeopleList
          people={sidePeople}
          activePeerId={dmPeer?.id}
          onSelect={openDm}
          className="w-52 flex-shrink-0"
        />
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3">
        <button
          type="button"
          data-testid="preview-simulate-leave"
          onClick={simulatePeerLeaveGroup}
          className="rounded-xl px-3 py-2 text-sm font-medium"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.35)' }}
        >
          Simulate peer leaves group
        </button>
        <button
          type="button"
          data-testid="preview-restore-peers"
          onClick={() => {
            setRoster(
              replacePresentRoster([
                { user_id: SELF_ID, name: 'You (temp)', photo_url: null },
                { user_id: 'peer-fox', name: 'Quiet Fox', photo_url: null },
                { user_id: 'peer-cub', name: 'Cub NW', photo_url: null },
              ]),
            );
            pushLog('Restored present roster');
          }}
          className="rounded-xl px-3 py-2 text-sm font-medium"
          style={{ background: 'rgba(196,131,42,0.15)', color: '#C4832A', border: '1px solid rgba(196,131,42,0.35)' }}
        >
          Restore present people
        </button>
      </div>

      <ul className="px-4 pb-6 font-mono text-[11px] text-[var(--cream-muted)]" data-testid="preview-log">
        {log.map((line, i) => (
          <li key={`${i}-${line}`}>· {line}</li>
        ))}
      </ul>

      {/* Assert no profile anchors rendered in this surface */}
      <p className="sr-only" data-testid="preview-no-profile-links">
        no profile deep-links
      </p>
    </div>
  );
}
