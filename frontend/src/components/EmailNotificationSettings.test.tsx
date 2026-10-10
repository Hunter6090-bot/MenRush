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
  api.get.mockResolvedValue({
    data: { enabled: true, jerkEnabled: false, messages: true, matches: true, jerks: true },
  });
  api.update.mockImplementation(async (patch: Record<string, boolean>) => ({
    data: { enabled: true, jerkEnabled: false, messages: true, matches: true, jerks: true, ...patch },
  }));
});

describe('Email notifications settings', () => {
  it('loads Messages and Matches, hides Jerks until the jerk flag, and saves a change', async () => {
    render(<EmailNotificationSettings />);
    const messages = await screen.findByTestId('email-notify-messages');
    expect(messages).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('email-notify-matches')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('email-notify-jerks')).not.toBeInTheDocument();
    expect(screen.queryByTestId('email-notify-jerks-soon')).not.toBeInTheDocument();
    fireEvent.click(messages);
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ messages: false }));
  });

  it('shows the Jerks tick when EMAIL_NOTIFY_JERK_ENABLED is on', async () => {
    api.get.mockResolvedValue({
      data: { enabled: true, jerkEnabled: true, messages: true, matches: true, jerks: true },
    });
    render(<EmailNotificationSettings />);
    expect(await screen.findByTestId('email-notify-jerks')).toBeInTheDocument();
  });

  it('hides the rows entirely when the master flag is off', async () => {
    api.get.mockResolvedValue({
      data: { enabled: false, jerkEnabled: false, messages: true, matches: true, jerks: true },
    });
    render(<EmailNotificationSettings />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('email-notification-settings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('email-notify-messages')).not.toBeInTheDocument();
  });
});

describe.each<Theme>(['light', 'dark'])('Email notifications contrast (%s)', (theme) => {
  it('15px text, 44px rows, 4.5:1, off-track border, theme tokens only', async () => {
    api.get.mockResolvedValue({
      data: { enabled: true, jerkEnabled: false, messages: false, matches: true, jerks: true },
    });
    render(<EmailNotificationSettings />);
    const root = await screen.findByTestId('email-notification-settings');
    expect(hardcodedColourClasses(root)).toEqual([]);
    for (const label of ['Messages', 'Matches']) {
      expect(contrast(screen.getByText(label), theme), `${label} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
    for (const id of ['messages', 'matches']) {
      const row = screen.getByTestId(`email-notify-${id}`);
      expect(row.className).toMatch(/min-h-\[44px\]/);
      expect(row.className).toMatch(/text-\[15px\]/);
    }
    const offTrack = screen.getByTestId('email-notify-messages-track');
    expect(offTrack.className).toMatch(/border-2/);
    expect(offTrack.className).toMatch(/border-\[var\(--cream\)\]/);
    expect(screen.getByText('Messages').className).toMatch(/text-\[15px\]/);
  });
});
