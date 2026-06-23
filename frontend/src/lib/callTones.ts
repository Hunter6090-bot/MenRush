// Lightweight call tones generated with the Web Audio API so we don't ship
// audio assets. Each tone honours browser autoplay restrictions: if the
// AudioContext cannot start (e.g. no prior user gesture), we fall back to a
// vibration cadence. We never pretend a tone is playing when it isn't.

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
}

// Outgoing ringback: low, slow, reassuring double tone (UK-style 400/450Hz).
// Incoming: brighter, faster warble so the two are clearly distinguishable.
const PATTERNS: Record<CallToneKind, TonePattern> = {
  outgoing: { freqs: [400, 450], onMs: 1200, offMs: 2400, type: 'sine', peakGain: 0.1 },
  incoming: { freqs: [587.33, 880], onMs: 700, offMs: 700, type: 'triangle', peakGain: 0.14 },
};

export interface CallTonePlayer {
  start: () => Promise<void>;
  stop: () => void;
}

export function createCallTone(kind: CallToneKind): CallTonePlayer {
  const pattern = PATTERNS[kind];
  let ctx: AudioContext | null = null;
  let beepTimer: ReturnType<typeof setTimeout> | null = null;
  let vibrateTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = true;

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

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(pattern.peakGain, now + 0.04);
    gain.gain.setValueAtTime(pattern.peakGain, now + Math.max(onSec - 0.06, 0.05));
    gain.gain.linearRampToValueAtTime(0, now + onSec);
    gain.connect(ctx.destination);

    pattern.freqs.forEach((freq) => {
      const osc = ctx!.createOscillator();
      osc.type = pattern.type;
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + onSec);
    });

    beepTimer = setTimeout(scheduleBeep, pattern.onMs + pattern.offMs);
  };

  return {
    async start() {
      if (!stopped) return;
      stopped = false;
      try {
        const AudioCtor: typeof AudioContext | undefined =
          typeof window !== 'undefined'
            ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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
          // stop() was called while we awaited resume().
          await ctx.close().catch(() => undefined);
          ctx = null;
          return;
        }
        if (ctx.state !== 'running') {
          // Autoplay blocked — degrade to vibration only.
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
