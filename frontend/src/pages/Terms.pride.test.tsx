import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Terms } from './Terms';

describe('Terms 7.7 Pride cutoff', () => {
  it('covers both Brighton promo codes and MenRush Pride invites, ending 31 October 2026', () => {
    render(
      <MemoryRouter>
        <Terms />
      </MemoryRouter>,
    );
    const clause = screen.getByText((_, el) => !!el && el.tagName === 'P' && /^7\.7\b/.test(el.textContent ?? ''));
    const text = clause.textContent ?? '';
    expect(text).toMatch(/Brighton Pride personal promo codes/);
    expect(text).toMatch(/MenRush Pride invites \(MENRUSH codes\)/);
    expect(text).toMatch(/31 October 2026 \(23:59:59 UK time\)/);
    expect(text).toMatch(/refused from 1 November 2026/);
    expect(text).not.toMatch(/beta/i);
    expect(text).not.toMatch(/[\u2013\u2014]/);
    expect(text).toMatch(/Pride replaces the 30 days of Premium in clause 7\.2/);
    expect(text).not.toMatch(/waitlist/i);
    // 7.2, 7.8 and 7.9 too: the 30 days of Premium, no waitlist wording anywhere in Terms.
    expect(document.body.textContent ?? '').not.toMatch(/waitlist/i);
  });
});
