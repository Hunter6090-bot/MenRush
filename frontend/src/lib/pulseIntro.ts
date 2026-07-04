const PULSE_INTRO_KEY = 'menrush:pulse-intro-dismissed';

export function isPulseIntroDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PULSE_INTRO_KEY) === '1';
}

export function dismissPulseIntro(): void {
  localStorage.setItem(PULSE_INTRO_KEY, '1');
}
