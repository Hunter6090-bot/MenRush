/**
 * Brand Soft receipt ticks (Ticket 6).
 * Follows app theme via data-theme / theme-light / theme-dark set by applyTheme.
 *
 * Night/dark skins:
 * - delivered: cream #F0E0C0
 * - read: copper #E0A14A
 *
 * Cream/paper light skins:
 * - delivered: ink #1E1508
 * - read: dark copper #8B5A1A
 *
 * No grey-on-grey.
 */

export const RECEIPT_TICK_COLORS = {
  dark: {
    delivered: '#F0E0C0',
    read: '#E0A14A',
  },
  light: {
    delivered: '#1E1508',
    read: '#8B5A1A',
  },
} as const;

export function getReceiptTickColor(read: boolean, theme: 'light' | 'dark' = 'dark'): string {
  return read ? RECEIPT_TICK_COLORS[theme].read : RECEIPT_TICK_COLORS[theme].delivered;
}
