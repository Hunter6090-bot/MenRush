import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Terms } from './Terms';

describe('Terms support links (rendered)', () => {
  it('every support@menrush.com is a mailto link with a 44px tap area, and the rendered text reads as Legal wrote it', () => {
    const { container } = render(
      <MemoryRouter>
        <Terms />
      </MemoryRouter>,
    );
    const links = screen.getAllByTestId('terms-support-mail') as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const a of links) {
      expect(a.getAttribute('href')).toBe('mailto:support@menrush.com');
      expect(a.textContent).toBe('support@menrush.com');
      expect(a.className).toContain('after:min-h-[44px]');
      expect(a.className).toContain('after:-inset-y-3');
    }
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    // No bare address anywhere outside a link.
    const linked = links.length;
    expect((text.match(/support@menrush\.com/g) ?? []).length).toBe(linked);
    // Spacing around the inline links survives rendering.
    expect(text).toContain('email support@menrush.com with your payment reference.');
    expect(text).toContain('To cancel, email support@menrush.com with your invoice reference.');
    expect(text).toContain('please email support@menrush.com and we will put it right');
    expect(text).toContain('7.6A You can cancel your Premium purchase within 14 days of buying it. When you buy, you choose when Premium starts:');
    expect(text).toContain('(b) If you leave the box unticked, Premium starts when the 14 days end, or when we confirm your payment if that is later. If you cancel within the 14 days, we refund what you paid in full.');
  });
});
