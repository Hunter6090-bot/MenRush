import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { contrast, hardcodedColourClasses, loadThemeTokens, type Theme } from '../test/themeContrast';
import { EmailNotificationSettings } from './EmailNotificationSettings';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
loadThemeTokens(read('../styles/menrush-tokens.css'));

const api = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../api/client', () => ({
  emailNotificationsAPI: {
    get: api.get,
    update: api.update,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { messages: true, matches: true, jerks: true } });
  api.update.mockImplementation(async (patch: Record<string, boolean>) => ({
    data: { messages: true, matches: true, jerks: true, ...patch },
  }));
});

describe('Email notifications settings', () => {
  it('loads three ticks, all on, and saves a change', async () => {
    render(<EmailNotificationSettings />);
    const messages = await screen.findByTestId('email-notify-messages');
    expect(messages).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('email-notify-matches')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('email-notify-jerks')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('email-notify-jerks-soon')).toHaveTextContent('Coming soon');
    fireEvent.click(messages);
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ messages: false }));
  });
});

describe.each<Theme>(['light', 'dark'])('Email notifications contrast (%s)', (theme) => {
  it('15px text, 44px rows, 4.5:1, theme tokens only', async () => {
    render(<EmailNotificationSettings />);
    const root = await screen.findByTestId('email-notification-settings');
    expect(hardcodedColourClasses(root)).toEqual([]);
    for (const label of ['Messages', 'Matches', 'Jerks']) {
      expect(contrast(screen.getByText(label), theme), `${label} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(screen.getByTestId('email-notify-jerks-soon'), theme)).toBeGreaterThanOrEqual(4.5);
    for (const id of ['messages', 'matches', 'jerks']) {
      const row = screen.getByTestId(`email-notify-${id}`);
      expect(row.className).toMatch(/min-h-\[44px\]/);
      expect(row.className).toMatch(/text-\[15px\]|[\s"]text-\[15px\]/);
    }
    expect(screen.getByText('Messages').className).toMatch(/text-\[15px\]/);
    expect(screen.getByTestId('email-notify-jerks-soon').className).toMatch(/text-\[15px\]/);
    expect(screen.getByTestId('email-notify-jerks-soon').className).toMatch(/text-\[var\(--cream-muted\)\]/);
  });
});
