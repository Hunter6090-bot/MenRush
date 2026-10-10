/**
 * Delete confirms (Community post / comment, Settings "Delete my posts") meet
 * WCAG AA in light and dark using theme tokens only; the map dock confirm
 * (always dark) meets AA too.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CONFIRM_BODY,
  CONFIRM_BOX,
  CONFIRM_CANCEL_BTN,
  CONFIRM_DANGER_BTN,
  CONFIRM_TITLE,
} from './confirmStyles';
import { contrast, hardcodedColourClasses, loadThemeTokens, type Theme } from '../test/themeContrast';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));
const dock = readFileSync(resolve(__dirname, '../components/DiscoverChatDock.tsx'), 'utf8');
const community = readFileSync(resolve(__dirname, '../components/CommunityFeed.tsx'), 'utf8');
const comments = readFileSync(resolve(__dirname, '../components/CommunityPostComments.tsx'), 'utf8');

function Confirm() {
  return (
    <div className="bg-[var(--bg-card)]">
      <div className={CONFIRM_BOX} data-testid="box">
        <p className={CONFIRM_TITLE}>Delete this post?</p>
        <p className={CONFIRM_BODY}>You can&apos;t undo this.</p>
        <button type="button" className={CONFIRM_DANGER_BTN}>Delete post</button>
        <button type="button" className={CONFIRM_CANCEL_BTN}>Cancel</button>
      </div>
    </div>
  );
}

describe.each<Theme>(['light', 'dark'])('Delete confirm contrast (%s)', (theme) => {
  it('title, body, Delete and Cancel are all >= 4.5:1, tokens only', () => {
    render(<Confirm />);
    expect(hardcodedColourClasses(screen.getByTestId('box'))).toEqual([]);
    for (const text of ['Delete this post?', "You can't undo this.", 'Delete post', 'Cancel']) {
      expect(contrast(screen.getByText(text), theme), `${text} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Delete confirms use the shared token styles', () => {
  it('Community post and comment confirms use CONFIRM_* (no red-300 / red-950 / cream-muted body)', () => {
    for (const src of [community, comments]) {
      expect(src).toContain('CONFIRM_BOX');
      expect(src).toContain('CONFIRM_TITLE');
      expect(src).toContain('CONFIRM_DANGER_BTN');
      expect(src).toContain('CONFIRM_CANCEL_BTN');
      expect(src).not.toMatch(/red-300|red-950|bg-red-600/);
    }
  });

  it('map dock confirm (always dark) colours are >= 4.5:1', () => {
    // Pull the dock confirm's colours from source and check them on its own opaque box.
    expect(dock).toContain('bg-[#1A130B]');
    render(
      <div className="bg-[#1A130B]">
        <p className="text-[#FF9A8A]">title</p>
        <p className="text-[#F0DFC0]">body</p>
        <button type="button" className="bg-[#FF9A8A] text-[#1A0E03]">delete</button>
      </div>,
    );
    expect(dock).toContain('text-[#FF9A8A]">Delete this post?');
    for (const t of ['title', 'body', 'delete']) {
      expect(contrast(screen.getByText(t), 'dark'), t).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Community copy locks', () => {
  it('no em or en dashes, no text under 15px', () => {
    for (const src of [community, comments]) {
      expect(src).not.toMatch(/[—–]/);
      expect(src).not.toMatch(/text-\[(?:[0-9]|1[0-4])px\]|\btext-(?:xs|sm)\b/);
    }
  });
});
