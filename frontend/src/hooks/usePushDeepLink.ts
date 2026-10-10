import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PUSH_CHAT_HINT_MESSAGE,
  PUSH_NAVIGATE_MESSAGE,
  peerIdFromMessagesUrl,
  requestChatRefresh,
  type PushClientMessage,
} from '../lib/pushDeepLink';

/**
 * Bridges service-worker push / notificationclick into the SPA.
 *
 * - Tap → navigate to the payload URL (React Router), so iOS does not depend
 *   on WindowClient.navigate() which often no-ops after focus().
 * - Push hint → refresh an already-open 1:1 thread when the socket may have
 *   missed the live event (common after iPhone PWA suspend).
 */
export function usePushDeepLink(enabled: boolean) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent<PushClientMessage>) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === PUSH_NAVIGATE_MESSAGE && typeof data.url === 'string') {
        const path = data.url.startsWith('http')
          ? (() => {
              try {
                const u = new URL(data.url);
                return `${u.pathname}${u.search}${u.hash}`;
              } catch {
                return data.url;
              }
            })()
          : data.url;
        navigate(path);
        const otherId = peerIdFromMessagesUrl(path);
        requestChatRefresh(otherId);
        return;
      }

      if (data.type === PUSH_CHAT_HINT_MESSAGE) {
        const otherId = data.otherId || peerIdFromMessagesUrl(data.url);
        requestChatRefresh(otherId);
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [enabled, navigate]);
}
