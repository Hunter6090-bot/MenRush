import { useState, useEffect, useCallback } from "react";
import { IconPulse, IconClose } from "./icons";

interface PulseFabProps {
  isPulsing: boolean;
  pulseExpiresAt?: string;
  nextPulseAllowedAt?: string;
  onStartPulse: (durationMin: 60 | 90 | 120) => Promise<void>;
  onStopPulse?: () => Promise<void>;
}

const DURATION_OPTIONS = [60, 90, 120] as const;
type Duration = (typeof DURATION_OPTIONS)[number];

export function PulseFab({
  isPulsing,
  pulseExpiresAt,
  nextPulseAllowedAt,
  onStartPulse,
  onStopPulse,
}: PulseFabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Duration>(90);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const minutesLeft = pulseExpiresAt
    ? Math.max(0, Math.ceil((new Date(pulseExpiresAt).getTime() - now) / 60000))
    : 0;

  const cooldownMinutesLeft = nextPulseAllowedAt
    ? Math.max(0, Math.ceil((new Date(nextPulseAllowedAt).getTime() - now) / 60000))
    : 0;

  const onCooldown = !isPulsing && cooldownMinutesLeft > 0;

  const handleStart = useCallback(async () => {
    setSubmitting(true);
    try {
      await onStartPulse(selected);
      setSheetOpen(false);
    } catch (err) {
      console.error("Pulse start failed:", err);
    } finally {
      setSubmitting(false);
    }
  }, [onStartPulse, selected]);

  const handleStop = useCallback(async () => {
    if (!onStopPulse) return;
    setSubmitting(true);
    try {
      await onStopPulse();
      setSheetOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [onStopPulse]);

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        disabled={onCooldown}
        aria-label={isPulsing ? `Pulsing — ${minutesLeft} min left` : "Go visible"}
        className={`
          fixed bottom-[calc(var(--fab-offset)+88px)] right-[var(--fab-offset)] z-40
          flex items-center justify-center
          w-[var(--fab-size)] h-[var(--fab-size)]
          rounded-full
          bg-[var(--copper)] text-[var(--bg-primary)]
          shadow-[var(--shadow-glow)]
          transition-all duration-[var(--duration-base)] ease-[var(--ease-out)]
          ${isPulsing ? "animate-pulse-glow" : ""}
          ${onCooldown ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"}
        `}
      >
        <IconPulse size={28} className={isPulsing ? "animate-pulse-breathe" : ""} />
        {isPulsing && (
          <span className="absolute -bottom-1 -right-1 bg-[var(--bg-primary)] text-[var(--copper)] text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[var(--copper)]">
            {minutesLeft}
          </span>
        )}
      </button>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
          onClick={() => !submitting && setSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="
              relative w-full sm:max-w-md
              bg-[var(--bg-elevated)] border border-[var(--border-default)]
              rounded-t-2xl sm:rounded-2xl
              p-6 sm:p-8
              shadow-[var(--shadow-lg)]
            "
          >
            <div className="flex items-center gap-3 mb-2">
              <IconPulse size={28} className="text-[var(--copper)]" />
              <h2 className="font-display text-2xl font-bold tracking-wide uppercase text-nn-text">
                Pulse
              </h2>
            </div>

            {isPulsing ? (
              <>
                <p className="text-[var(--cream-soft)] mb-6">
                  You're pulsing. {minutesLeft} {minutesLeft === 1 ? "minute" : "minutes"} left.
                </p>
                <p className="text-nn-muted text-sm mb-6 leading-relaxed">
                  Your avatar pulses on the map. You sit at the top of nearby lists.
                </p>
                {onStopPulse && (
                  <button
                    onClick={handleStop}
                    disabled={submitting}
                    className="w-full py-4 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--cream)] hover:border-[var(--copper)] transition-colors"
                  >
                    {submitting ? "Stopping…" : "End Pulse early"}
                  </button>
                )}
              </>
            ) : onCooldown ? (
              <>
                <p className="text-[var(--cream-soft)] mb-6">
                  Pulse cooldown.
                </p>
                <p className="text-nn-muted text-sm leading-relaxed">
                  Pulse again in {cooldownMinutesLeft} min.
                  <br /><br />
                  <span className="text-nn-copper">MenRush Premium</span> cuts cooldown to 90 min.
                </p>
              </>
            ) : (
              <>
                <p className="text-nn-muted mb-6 leading-relaxed">
                  Go visible. <span className="text-nn-copper font-semibold">5 km radius.</span>
                </p>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  {DURATION_OPTIONS.map((min) => (
                    <button
                      key={min}
                      onClick={() => setSelected(min)}
                      className={`
                        py-4 rounded-[var(--radius-md)] font-semibold text-sm
                        transition-all duration-[var(--duration-fast)]
                        ${
                          selected === min
                            ? "bg-[var(--copper)] text-[var(--bg-primary)] shadow-[var(--shadow-glow)]"
                            : "bg-[var(--bg-card)] text-[var(--cream-soft)] border border-[var(--border-default)] hover:border-[var(--copper)]"
                        }
                      `}
                    >
                      {min} min
                    </button>
                  ))}
                </div>

                <p className="text-[var(--cream-muted)] text-xs leading-relaxed mb-6">
                  Pulsing puts you at the top of nearby lists. Your avatar pulses on the map. <strong>Cooldown: 4 hours.</strong>
                </p>

                <button
                  onClick={handleStart}
                  disabled={submitting}
                  className="
                    w-full py-4 rounded-[var(--radius-md)]
                    bg-[var(--copper)] text-[var(--bg-primary)]
                    font-bold tracking-[var(--tracking-wider)]
                    shadow-[var(--shadow-glow)]
                    hover:bg-[var(--copper-light)]
                    active:scale-[0.98]
                    transition-all duration-[var(--duration-fast)]
                    disabled:opacity-50
                  "
                >
                  {submitting ? "Starting…" : "Start pulse"}
                </button>
              </>
            )}

            <button
              onClick={() => !submitting && setSheetOpen(false)}
              className="absolute top-4 right-4 text-nn-muted hover:text-nn-text transition-colors"
              aria-label="Close"
            >
              <IconClose size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
