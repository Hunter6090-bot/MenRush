/**
 * One prompt at a time (QC P1 on #354).
 *
 * The Get the app sheet, the alerts banner and the Finish profile prompts used
 * to stack on top of each other. Each prompt now reports its state here and
 * only the highest priority prompt that wants to show is rendered:
 *
 *   1. Get the app sheet (and the iPhone Add to Home Screen banner)
 *   2. Turn on alerts
 *   3. Finish profile (top strip and the Discover banner)
 *
 * A prompt that is still working out whether it wants to show ('pending')
 * holds back every lower prompt, so a lower one never flashes up and is then
 * replaced. The next prompt appears only once the current one is closed or
 * hidden (its state goes to 'none' or it unmounts). Once on screen a prompt
 * keeps the slot until then, even if a higher one turns up later.
 */
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

export type PromptSlot = 'install-sheet' | 'install-banner' | 'alerts' | 'profile';
export type PromptSlotState = 'pending' | 'want' | 'none';

export const PROMPT_SLOT_ORDER: readonly PromptSlot[] = [
  'install-sheet',
  'install-banner',
  'alerts',
  'profile',
];

interface Registration {
  slot: PromptSlot;
  state: PromptSlotState;
}

const registrations = new Map<number, Registration>();
const listeners = new Set<() => void>();
let nextId = 1;
let active: PromptSlot | null = null;
let locked: PromptSlot | null = null;

function compute(): PromptSlot | null {
  // Sticky: the prompt on screen keeps the slot until it is closed or hidden,
  // even if a higher one turns up later (a slow check, a route change). So
  // nothing is swapped out from under the member.
  // Only a prompt that has actually been painted is locked in (see usePromptSlot),
  // so mount order within one commit cannot lock in the wrong one.
  if (locked) {
    for (const reg of registrations.values()) {
      if (reg.slot === locked && reg.state === 'want') return locked;
    }
    locked = null;
  }
  for (const slot of PROMPT_SLOT_ORDER) {
    let pending = false;
    for (const reg of registrations.values()) {
      if (reg.slot !== slot) continue;
      if (reg.state === 'want') return slot;
      if (reg.state === 'pending') pending = true;
    }
    if (pending) return null;
  }
  return null;
}

function update(): void {
  const next = compute();
  if (next === active) return;
  active = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getActive(): PromptSlot | null {
  return active;
}

/** The prompt allowed on screen right now, or null. */
export function activePromptSlot(): PromptSlot | null {
  return active;
}

/**
 * Report this prompt's state and learn whether it may render. Registration
 * runs in a layout effect so every mounted prompt has reported before the
 * first paint.
 */
export function usePromptSlot(slot: PromptSlot, state: PromptSlotState): boolean {
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = nextId++;
  const id = idRef.current;

  useLayoutEffect(() => {
    registrations.set(id, { slot, state });
    update();
  }, [id, slot, state]);

  useLayoutEffect(
    () => () => {
      registrations.delete(id);
      update();
    },
    [id],
  );

  const current = useSyncExternalStore(subscribe, getActive, getActive);
  const visible = state === 'want' && current === slot;

  // Passive effect: runs once the prompt is on screen, after every prompt in the
  // same commit has registered.
  useEffect(() => {
    if (visible && active === slot) locked = slot;
  }, [visible, slot]);

  return visible;
}

/** Test-only: forget every registration between Vitest cases. */
export function resetPromptSlotsForTests(): void {
  registrations.clear();
  active = null;
  locked = null;
  for (const listener of listeners) listener();
}
