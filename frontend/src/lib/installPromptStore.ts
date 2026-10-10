/**
 * Module-level BeforeInstallPromptEvent store.
 *
 * The browser fires `beforeinstallprompt` once. If we only keep it in React
 * state, navigating away (InstallPrompt unmount → /get-the-app) drops it and
 * Android falls back to the Safari-style how-to. Persist here so Login banner,
 * Get the App, and any later screen can still call prompt().
 */

import { useEffect, useState } from 'react';
import { registerServiceWorker } from './push';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Listener = (event: BeforeInstallPromptEvent | null) => void;

let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener(deferred);
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  deferred = event as BeforeInstallPromptEvent;
  notify();
}

function onAppInstalled() {
  deferred = null;
  notify();
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function clearDeferredInstallPrompt(): void {
  deferred = null;
  notify();
}

export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  listener(deferred);
  return () => {
    listeners.delete(listener);
  };
}

/** Call once at app boot (main.tsx). Safe to call repeatedly. */
export function startInstallPromptCapture(): void {
  if (typeof window === 'undefined' || started) return;
  started = true;

  // SW is part of Chrome's installability criteria — register early so the
  // event is more likely to fire after first paint, not only on push screens.
  void registerServiceWorker();

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
}

/** React hook — stays in sync with the module store across mounts. */
export function useDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(() => getDeferredInstallPrompt());
  useEffect(() => subscribeInstallPrompt(setEvent), []);
  return event;
}

/** Test-only: reset module state between Vitest cases. */
export function resetInstallPromptStoreForTests(): void {
  if (typeof window !== 'undefined' && started) {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  }
  deferred = null;
  started = false;
  listeners.clear();
}
