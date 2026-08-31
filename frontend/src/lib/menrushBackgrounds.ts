export const MENRUSH_BACKGROUND_IMAGES = [
  "/images/menrush/01-rooftop-skyline-bears.jpeg",
  "/images/menrush/02-soho-night-crowd.jpeg",
  "/images/menrush/03-rooftop-mixed-evening.jpeg",
  "/images/menrush/04-leather-harness-bears.jpeg",
  "/images/menrush/05-beach-bonfire-dusk.jpeg",
  "/images/menrush/06-mediterranean-beach.jpeg",
  "/images/menrush/07-leather-bar-close.jpeg",
  "/images/menrush/08-park-phones-night.jpeg",
  "/images/menrush/09-cigar-daddy-bar.jpeg",
  "/images/menrush/10-sitges-street-summer.jpeg",
  "/images/menrush/11-brighton-beach-pier.jpeg",
  "/images/menrush/12-bear-bar-red-lights.jpeg",
  "/images/menrush/13-rooftop-pool-bears.jpeg",
  "/images/menrush/14-soho-rainbow-crowd.jpeg",
  "/images/menrush/15-underground-leather-bar.jpeg",
  "/images/menrush/16-amsterdam-neon-night.jpeg",
  "/images/menrush/17-rooftop-bar-skyline.jpeg",
  "/images/menrush/18-bears-hollow-sign.jpeg",
  "/images/menrush/19-soho-pub-night.jpeg",
  "/images/menrush/20-cruisers-copse-sign.jpeg",
  "/images/menrush/21-pride-parade-flags.jpeg",
  "/images/menrush/22-daddy-twink-bar.jpeg",
  "/images/menrush/23-beach-bears-skyline.jpeg",
  "/images/menrush/24-west-heath-lane-sign.jpeg",
  "/images/menrush/25-amsterdam-canal-cruise.jpeg",
  "/images/menrush/26-rainy-square-blue-hour.jpeg",
  "/images/menrush/27-golden-beach-sunset.jpeg",
  "/images/menrush/28-bear-pride-flag-day.jpeg",
  "/images/menrush/29-brighton-pride-bunting.jpeg",
  "/images/menrush/30-bear-portrait-night.jpeg",
  "/images/menrush/31-london-rooftop-dusk.jpeg",
  "/images/menrush/32-laser-club-shirtless.jpeg",
  "/images/menrush/33-amsterdam-canal-pride.jpeg",
  "/images/menrush/34-cruising-bushes-dusk.jpeg",
  "/images/menrush/35-string-lights-festival.jpeg",
  "/images/menrush/36-wet-street-bar-line.jpeg",
  "/images/menrush/37-park-cruising-silhouettes.jpeg",
  "/images/menrush/38-club-line-night.jpeg",
  "/images/menrush/39-the-club-cigarettes.jpeg",
  "/images/menrush/40-copenhagen-pride-march.jpeg",
  "/images/menrush/41-twink-jock-neon-street.jpeg",
  "/images/menrush/42-wolf-mask-leather-bar.jpeg",
  "/images/menrush/43-club-dance-shirtless.jpeg",
  "/images/menrush/44-bears-leather-vests.jpeg",
  "/images/menrush/45-string-lights-crowd.jpeg",
  "/images/menrush/46-pool-bears-rooftop.jpeg",
  "/images/menrush/47-rooftop-berlin-night.jpeg",
  "/images/menrush/48-1990s-bear-community-events.jpeg",
  "/images/menrush/49-2020s-modern-bear-subculture.jpeg",
  "/images/menrush/50-bears-biker-club-house.jpeg",
  "/images/menrush/51-bears-leather-biker.jpeg",
  "/images/menrush/52-brighton-beach-sunset.jpeg",
  "/images/menrush/53-cruiser-copse.jpeg",
  "/images/menrush/54-give-it-all-leather.jpeg",
  "/images/menrush/55-hampstead-cruising-spot.jpeg",
  "/images/menrush/56-in-the-bar.jpeg",
  "/images/menrush/57-lads-meet.jpeg",
  "/images/menrush/58-mens-only.jpeg",
  "/images/menrush/59-muscular-hairy-type.jpeg",
  "/images/menrush/60-older-gray-haired-bear.jpeg",
  "/images/menrush/61-outside-after-the-club.jpeg",
  "/images/menrush/62-party-stage-night.jpeg",
  "/images/menrush/63-sitges-night-crowd.jpeg",
  "/images/menrush/64-west-heath-lane.jpeg",
  "/images/menrush/65-wood-meet.jpeg",
] as const;

export type MenrushBackgroundImage = (typeof MENRUSH_BACKGROUND_IMAGES)[number];

/** One photo per tab until a hard refresh. Shared by /login and /register. */
export const AUTH_BACKGROUND_SESSION_KEY = 'menrush.authBackground';

const BACKGROUND_SET = new Set<string>(MENRUSH_BACKGROUND_IMAGES);

let pickedThisJsLoad: MenrushBackgroundImage | null = null;

function randomBackground(): MenrushBackgroundImage {
  return (
    MENRUSH_BACKGROUND_IMAGES[Math.floor(Math.random() * MENRUSH_BACKGROUND_IMAGES.length)] ??
    MENRUSH_BACKGROUND_IMAGES[0]
  );
}

function isReloadNavigation(): boolean {
  const entry = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  return entry?.type === 'reload';
}

export function resetAuthBackgroundPickForTests(): void {
  pickedThisJsLoad = null;
}

export function pickSessionAuthBackground(): MenrushBackgroundImage {
  if (pickedThisJsLoad) return pickedThisJsLoad;

  try {
    if (!isReloadNavigation()) {
      const stored = sessionStorage.getItem(AUTH_BACKGROUND_SESSION_KEY);
      if (stored && BACKGROUND_SET.has(stored)) {
        pickedThisJsLoad = stored as MenrushBackgroundImage;
        return pickedThisJsLoad;
      }
    }
    const next = randomBackground();
    sessionStorage.setItem(AUTH_BACKGROUND_SESSION_KEY, next);
    pickedThisJsLoad = next;
    return next;
  } catch {
    const next = randomBackground();
    pickedThisJsLoad = next;
    return next;
  }
}
