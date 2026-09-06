import { useCallback, useLayoutEffect, useRef } from 'react';

/** Keep subscriptions stable while their handlers read the latest committed state. */
export function useLatestCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const latest = useRef(callback);
  useLayoutEffect(() => {
    latest.current = callback;
  }, [callback]);
  return useCallback((...args: Args) => latest.current(...args), []);
}
