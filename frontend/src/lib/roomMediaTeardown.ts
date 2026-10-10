/**
 * Hard teardown for Video rooms / group-call local media.
 * iOS/Android keep the camera/mic indicator on until every track is stopped
 * and peer-connection senders release hardware — closing the PC alone is not enough.
 */

export function stopMediaStreamTracks(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
}

/** Stop sender tracks, drop handlers, close the PC (mirrors 1:1 releaseMedia). */
export function closeRoomPeerConnection(pc: RTCPeerConnection | null | undefined): void {
  if (!pc) return;
  try {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onnegotiationneeded = null;
    pc.onconnectionstatechange = null;
  } catch {
    /* ignore */
  }

  try {
    for (const sender of pc.getSenders()) {
      try {
        sender.track?.stop();
      } catch {
        /* ignore */
      }
      try {
        void sender.replaceTrack(null);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  try {
    for (const receiver of pc.getReceivers()) {
      try {
        receiver.track?.stop();
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  try {
    pc.close();
  } catch {
    /* ignore */
  }
}

/**
 * Full local hangup: stop every track on the local stream and tear down peers.
 * Returns whether local hardware was released (for idle glyph / media-state).
 */
export function teardownRoomLocalMedia(options: {
  localStream?: MediaStream | null;
  peerConnections?: Iterable<RTCPeerConnection | null | undefined>;
}): { released: boolean } {
  const { localStream, peerConnections } = options;
  let released = false;

  if (peerConnections) {
    for (const pc of peerConnections) {
      if (pc) {
        closeRoomPeerConnection(pc);
        released = true;
      }
    }
  }

  if (localStream) {
    const hadLive = localStream.getTracks().some((t) => t.readyState !== 'ended');
    stopMediaStreamTracks(localStream);
    if (hadLive || localStream.getTracks().length > 0) released = true;
  }

  return { released };
}
