import { useState, useEffect, useCallback } from "react";
import { IconPulse, IconClose } from "./icons";
import { dismissPulseIntro, isPulseIntroDismissed } from "../lib/pulseIntro";
import { formatRadiusFromKm } from "../lib/localeUnits";

interface PulseFabProps {
  isPulsing: boolean;
  pulseExpiresAt?: string;
  nextPulseAllowedAt?: string;
  isPremium?: boolean;
  onStartPulse: (durationMin: 60 | 90 | 120) => Promise<void>;
  onStopPulse?: () => Promise<void>;
}

const DURATION_OPTIONS = [60, 90, 120] as const;
type Duration = (typeof DURATION_OPTIONS)[number];
type ModalView = "intro" | "sheet";

export function PulseFab({
  isPulsing,
  pulseExpiresAt,
  nextPulseAllowedAt,
  isPremium = false,
  onStartPulse,
  onStopPulse,
}: PulseFabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<ModalView>("sheet");
  const [dontShowIntroAgain, setDontShowIntroAgain] = useState(false);
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

  const cooldownHoursLeft = cooldownMinutesLeft > 0 ? Math.ceil(cooldownMinutesLeft / 60) : 0;
  const onCooldown = !isPulsing && !isPremium && cooldownMinutesLeft > 0;

  const openModal = useCallback(() => {
    const showIntro = !isPulsing && !onCooldown && !isPulseIntroDismissed();
    setDontShowIntroAgain(false);
    setModalView(showIntro ? "intro" : "sheet");
    setModalOpen(true);
  }, [isPulsing, onCooldown]);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalOpen(false);
    setModalView("sheet");
    setDontShowIntroAgain(false);
  }, [submitting]);

  const continueFromIntro = useCallback(() => {
    if (dontShowIntroAgain) dismissPulseIntro();
    setModalView("sheet");
  }, [dontShowIntroAgain]);

  const handleStart = useCallback(async () => {
    setSubmitting(true);
    try {
      await onStartPulse(selected);
      setModalOpen(false);
      setModalView("sheet");
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
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [onStopPulse]);

  return (
    <>
      <button
        onClick={openModal}
        disabled={onCooldown}
        aria-label={isPulsing ? `Pulsing — ${minutesLeft} min left` : "Pulse — go visible"}
        data-testid="pulse-fab"
        className={`
          fixed bottom-[calc(var(--fab-offset)+88px)] right-[var(--fab-offset)] z-40
          flex flex-col items-center justify-center gap-0.5
          w-[var(--fab-size)] h-[var(--fab-size)]
          rounded-full
          bg-[var(--copper)] text-[var(--bg-primary)]
          shadow-[var(--shadow-glow)]
          transition-all duration-[var(--duration-base)] ease-[var(--ease-out)]
          ${isPulsing ? "animate-pulse-glow" : ""}
          ${onCooldown ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"}
        `}
      >
        <IconPulse
          size={22}
          className={`absolute opacity-30 ${isPulsing ? "animate-pulse-breathe" : ""}`}
          aria-hidden
        />
        <span
          className={`relative z-10 font-display text-[13px] font-black uppercase leading-none tracking-[0.08em] ${
            isPulsing ? "animate-pulse-breathe" : ""
          }`}
        >
          Pulse
        </span>
        {isPulsing && (
          <span className="absolute -bottom-1 -right-1 z-20 bg-[var(--bg-primary)] text-[var(--copper)] text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[var(--copper)]">
            {minutesLeft}
          </span>
        )}
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          onClick={closeModal}
          data-testid="pulse-modal"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="
              relative w-full sm:max-w-md max-h-[min(88vh,640px)] overflow-y-auto
              bg-[var(--bg-elevated)] border border-[var(--border-default)]
              rounded-t-2xl sm:rounded-2xl
              px-6 pt-6 pb-[calc(var(--mobile-tab-bar-height)+1.25rem)] sm:pb-8
              shadow-[var(--shadow-lg)]
            "
          >
            {modalView === "intro" ? (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <IconPulse size={28} className="text-[var(--copper)] animate-pulse-breathe" />
                  <h2 className="font-display text-2xl font-bold tracking-wide uppercase text-nn-text">
                    What is Pulse?
                  </h2>
                </div>

                <p className="text-[var(--cream-soft)] mb-4 leading-relaxed">
                  Pulse puts you <span className="text-nn-copper font-semibold">live on the map</span> right
                  now. Your avatar glows on the map and you jump to the top of nearby lists for a limited time.
                </p>
                <ul className="mb-6 space-y-2 text-sm text-nn-muted leading-relaxed">
                  <li>· Visible to men within your discovery radius</li>
                  <li>· Great when you&apos;re out and open to meeting now</li>
                  <li>· Free members: one pulse every 24 hours</li>
                </ul>

                <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-3">
                  <input
                    type="checkbox"
                    checked={dontShowIntroAgain}
                    onChange={(event) => setDontShowIntroAgain(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--copper)]"
                    data-testid="pulse-intro-dismiss"
                  />
                  <span className="text-sm text-[var(--cream-soft)] leading-snug">
                    Don&apos;t show this message again
                  </span>
                </label>

                <button
                  type="button"
                  onClick={continueFromIntro}
                  className="w-full py-4 rounded-[var(--radius-md)] bg-[var(--copper)] text-[var(--bg-primary)] font-bold shadow-[var(--shadow-glow)] hover:bg-[var(--copper-light)] transition-colors"
                  data-testid="pulse-intro-continue"
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <IconPulse size={28} className="text-[var(--copper)]" />
                  <h2 className="font-display text-2xl font-bold tracking-wide uppercase text-nn-text">
                    Pulse
                  </h2>
                </div>

                {isPulsing ? (
                  <>
                    <p className="text-[var(--cream-soft)] mb-6">
                      You&apos;re pulsing. {minutesLeft} {minutesLeft === 1 ? "minute" : "minutes"} left.
                    </p>
                    <p className="text-nn-muted text-sm mb-6 leading-relaxed">
                      Your avatar pulses on the map. You sit at the top of nearby lists.
                    </p>
                    {onStopPulse && (
                      <button
                        onClick={handleStop}
                        disabled={submitting}
                        className="sticky bottom-0 w-full py-4 rounded-[var(--radius-md)] bg-[var(--copper)] text-[var(--bg-primary)] font-bold shadow-[var(--shadow-glow)] hover:bg-[var(--copper-light)] transition-colors disabled:opacity-50"
                      >
                        {submitting ? "Stopping…" : "End Pulse early"}
                      </button>
                    )}
                  </>
                ) : onCooldown ? (
                  <>
                    <p className="text-[var(--cream-soft)] mb-6">
                      Pulse cooldown — free members get one pulse every 24 hours.
                    </p>
                    <p className="text-nn-muted text-sm leading-relaxed">
                      Pulse again in about {cooldownHoursLeft}{" "}
                      {cooldownHoursLeft === 1 ? "hour" : "hours"} ({cooldownMinutesLeft} min).
                      <br />
                      <br />
                      <span className="text-nn-copper">MenRush Premium</span> unlocks unlimited pulses.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-nn-muted mb-6 leading-relaxed">
                      Go visible. <span className="text-nn-copper font-semibold">{formatRadiusFromKm(5)} radius.</span>
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
                      Pulsing puts you at the top of nearby lists. Your avatar pulses on the map.
                      {isPremium ? (
                        <> <strong>Premium: unlimited pulses.</strong></>
                      ) : (
                        <> <strong>Free: once every 24 hours.</strong></>
                      )}
                    </p>

                    <button
                      onClick={handleStart}
                      disabled={submitting}
                      data-testid="pulse-start"
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
                      {submitting ? "Starting…" : "Start Pulse"}
                    </button>
                  </>
                )}
              </>
            )}

            <button
              onClick={closeModal}
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
