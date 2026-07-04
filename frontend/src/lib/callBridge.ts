/** Bridges Messaging's tap handler to VideoCallModal's WebRTC setup (iOS needs getUserMedia in the gesture chain). */
type OutgoingCallHandler = (peerId: string, peerName: string) => Promise<void>;

let outgoingHandler: OutgoingCallHandler | null = null;

export function registerOutgoingCallHandler(handler: OutgoingCallHandler | null) {
  outgoingHandler = handler;
}

export async function placeOutgoingCall(peerId: string, peerName: string): Promise<void> {
  if (!outgoingHandler) {
    throw new Error('signalling_unavailable');
  }
  await outgoingHandler(peerId, peerName);
}
