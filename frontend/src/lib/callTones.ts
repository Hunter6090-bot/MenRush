// Call tones: outgoing always uses Web Audio oscillators. Incoming prefers a
// Legal/Brand-cleared file at CALL_RING_TRIM_SRC when the clearance marker is
// present; otherwise keeps the existing generic oscillator (Legal GREEN
// interim — no Trim/Nokia audio is shipped in this repo).
// See docs/legal-call-ring-trim.md and frontend/public/audio/README.md.

import {
  fetchClearedRingManifest,
  incomingRingSourceFromManifest,
  resolveClearedRingSrc,
  type IncomingRingSource,
} from './callRingAsset';

export type CallToneKind = 'incoming' | 'outgoing';

interface TonePattern {
  // Frequencies layered together for each beep (Hz).
  freqs: number[];
  // Audible portion of one cadence cycle (ms).
  onMs: number;
  // Silent portion of one cadence cycle (ms).
  offMs: number;
  type: OscillatorType;
  peakGain: number;
  /** Stagger each frequency within one ring (ms) — soft arpeggio. */
  staggerMs?: number;
}

// Outgoing ringback: low, slow, reassuring double tone (UK-style 400/450Hz).
// Incoming (placeholder until cleared Trim): gentle C-major arpeggio — not Trim,
// not Nokia-branded, royalty-clear synthesized tones only.
const PATTERNS: Record<CallToneKind, TonePattern> = {
  outgoing: { freqs: [400, 450], onMs: 1200, offMs: 2400, type: 'sine', peakGain: 0.1 },
  incoming: {
    freqs: [523.25, 659.25, 783.99],
    onMs: 1400,
    offMs: 3600,
    type: 'sine',
    peakGain: 0.055,
    staggerMs: 220,
  },
};

export interface CallTonePlayer {
  start: () => Promise<void>;
  stop: () => void;
  /** What actually played after start() resolved (for tests / UI probe). */
  getSource: () => IncomingRingSource | 'outgoing';
}

function createOscillatorTone(kind: CallToneKind): CallTonePlayer {
  const pattern = PATTERNS[kind];
  let ctx: AudioContext | null = null;
  let beepTimer: ReturnType<typeof setTimeout> | null = null;
  let vibrateTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = true;
  const sourceLabel: IncomingRingSource | 'outgoing' = kind === 'outgoing' ? 'outgoing' : 'generic';

  const canVibrate = () =>
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  const startVibrationFallback = () => {
    if (!canVibrate()) return;
    const cycle = () => navigator.vibrate(pattern.onMs);
    cycle();
    vibrateTimer = setInterval(cycle, pattern.onMs + pattern.offMs);
  };

  const scheduleBeep = () => {
    if (stopped || !ctx) return;
    const now = ctx.currentTime;
    const onSec = pattern.onMs / 1000;

    pattern.freqs.forEach((freq, index) => {
      const staggerSec = ((pattern.staggerMs ?? 0) * index) / 1000;
      const noteStart = now + staggerSec;
      const noteLength = pattern.staggerMs ? 0.42 : onSec;
      const noteEnd = noteStart + noteLength;

      const gain = ctx!.createGain();
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(pattern.peakGain, noteStart + 0.03);
      gain.gain.setValueAtTime(pattern.peakGain, noteEnd - 0.08);
      gain.gain.linearRampToValueAtTime(0, noteEnd);
      gain.connect(ctx!.destination);

      const osc = ctx!.createOscillator();
      osc.type = pattern.type;
      osc.frequency.setValueAtTime(freq, noteStart);
      osc.connect(gain);
      osc.start(noteStart);
      osc.stop(noteEnd);
    });

    beepTimer = setTimeout(scheduleBeep, pattern.onMs + pattern.offMs);
  };

  return {
    getSource: () => sourceLabel,
    async start() {
      if (!stopped) return;
      stopped = false;
      try {
        const AudioCtor: typeof AudioContext | undefined =
          typeof window !== 'undefined'
            ? window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
            : undefined;
        if (!AudioCtor) {
          startVibrationFallback();
          return;
        }
        ctx = new AudioCtor();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => undefined);
        }
        if (stopped) {
          await ctx.close().catch(() => undefined);
          ctx = null;
          return;
        }
        if (ctx.state !== 'running') {
          startVibrationFallback();
          return;
        }
        scheduleBeep();
      } catch {
        startVibrationFallback();
      }
    },
    stop() {
      stopped = true;
      if (beepTimer) {
        clearTimeout(beepTimer);
        beepTimer = null;
      }
      if (vibrateTimer) {
        clearInterval(vibrateTimer);
        vibrateTimer = null;
      }
      if (canVibrate()) navigator.vibrate(0);
      if (ctx) {
        ctx.close().catch(() => undefined);
        ctx = null;
      }
    },
  };
}

function createAssetTone(src: string): CallTonePlayer {
  let audio: HTMLAudioElement | null = null;
  let stopped = true;
  let fellBack: CallTonePlayer | null = null;

  return {
    getSource: () => (fellBack ? fellBack.getSource() : 'asset'),
    async start() {
      if (!stopped) return;
      stopped = false;
      if (typeof Audio === 'undefined') {
        fellBack = createOscillatorTone('incoming');
        await fellBack.start();
        return;
      }
      try {
        audio = new Audio(src);
        audio.loop = true;
        audio.preload = 'auto';
        await audio.play();
        if (stopped) {
          audio.pause();
          audio.src = '';
          audio = null;
          return;
        }
      } catch {
        // Autoplay block or missing/corrupt file → generic oscillator, never silent.
        audio = null;
        fellBack = createOscillatorTone('incoming');
        await fellBack.start();
      }
    },
    stop() {
      stopped = true;
      if (fellBack) {
        fellBack.stop();
        fellBack = null;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
      if (audio) {
        audio.pause();
        audio.src = '';
        audio = null;
      }
    },
  };
}

/**
 * Create a call tone player.
 * Incoming: cleared Trim/asset path when marker present; else generic Web Audio.
 * Outgoing: always generic ringback oscillators.
 */
export function createCallTone(kind: CallToneKind): CallTonePlayer {
  if (kind === 'outgoing') {
    return createOscillatorTone('outgoing');
  }

  let active: CallTonePlayer | null = null;
  let stopped = true;
  let source: IncomingRingSource = 'generic';

  return {
    getSource: () => (active ? active.getSource() : source),
    async start() {
      if (!stopped) return;
      stopped = false;
      const manifest = await fetchClearedRingManifest();
      if (stopped) return;
      const src = resolveClearedRingSrc(manifest);
      source = incomingRingSourceFromManifest(manifest);
      active = src ? createAssetTone(src) : createOscillatorTone('incoming');
      await active.start();
      if (stopped) {
        active.stop();
        active = null;
      }
    },
    stop() {
      stopped = true;
      if (active) {
        active.stop();
        active = null;
      }
    },
  };
}

export { CALL_RING_TRIM_SRC, CALL_RING_TRIM_CLEARED_MARKER } from './callRingAsset';
