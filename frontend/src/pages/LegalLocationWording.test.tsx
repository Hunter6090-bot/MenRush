import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Terms } from './Terms';
import { Privacy } from './Privacy';

/** Legal ruling 10 Oct 2026, word for word. Written out here, not imported, so a drift in the copy fails. */
const RETENTION =
  "We keep your current location while your account is open. It's replaced each time your device sends a new one, including when you use Ghost mode, and we delete it when you delete your account. We also keep the location from when you first joined. When you post to the map or the community, we automatically save your exact location with that post. We keep it with the post until you delete the post or your account. Locations you share in a chat are kept until that chat or your account is deleted, and check-ins are kept until your account is deleted. We're shortening how long we keep location data and will update this section when that's in place.";

/** Rendered text with whitespace collapsed, so JSX line breaks do not matter. */
function pageText(ui: React.ReactElement): string {
  const { container, unmount } = render(<MemoryRouter>{ui}</MemoryRouter>);
  const text = (container.textContent ?? '').replace(/\s+/g, ' ');
  unmount();
  return text;
}

describe('Legal location wording (Legal, Oct 2026)', () => {
  it('Terms 6.3 uses the plain location lines', () => {
    const text = pageText(<Terms />);
    expect(text).toContain(
      'Unless you choose to share it yourself in a chat, we never show your exact location to other members. They see an approximate position, moved by your Discretion setting, and distances rounded to "under 1 mile" or whole miles. Members who choose Ghost or hidden mode don\'t appear on the map.',
    );
    expect(text).toContain(
      'If you choose to share a place or location yourself, for example in a chat or a check-in, other members will see what you share.',
    );
  });

  it('Terms 6.2 carries the approximate location risk line', () => {
    const text = pageText(<Terms />);
    expect(text).toContain(
      'your approximate location being visible to other members, unless you use Ghost or hidden mode. Even an approximate location can help someone nearby work out roughly where you are, so set Discretion to suit you.',
    );
  });

  it('Terms drops the old proximity example and shows the new date', () => {
    const text = pageText(<Terms />);
    expect(text).not.toContain('500m away');
    expect(text).not.toContain('Your exact GPS coordinates are never shared');
    expect(text).toContain('Last updated: 10 October 2026');
  });

  it('Privacy uses the precise location and rounded distance lines', () => {
    const text = pageText(<Privacy />);
    expect(text).toContain(
      'Precise location from your device, with your permission, when you use the map and nearby discovery. We use it to work out an approximate position and rounded distance that other members can see. Unless you choose to share it yourself in a chat, we never show your exact location to other members.',
    );
    expect(text).toContain('Distances are shown rounded, as "under 1 mile" or in whole miles.');
    expect(text).not.toContain('privacy-bucketed');
  });

  it('Terms 6.5 is the Legal retention wording, word for word, with no 6 months', () => {
    const text = pageText(<Terms />);
    expect(text).toContain(`6.5 ${RETENTION}`);
    expect(text).not.toMatch(/6 months|six months/i);
    expect(text).not.toContain('Location data is retained');
  });

  it('Privacy has a location retention section with the same wording and no 6 months', () => {
    const { getByRole, getByTestId, unmount } = render(
      <MemoryRouter>
        <Privacy />
      </MemoryRouter>,
    );
    expect(getByRole('heading', { name: 'How long we keep location' })).toBeInTheDocument();
    const retention = (getByTestId('privacy-location-retention').textContent ?? '').replace(/\s+/g, ' ').trim();
    expect(retention).toBe(RETENTION);
    expect(retention).not.toMatch(/6 months|six months/i);
    unmount();
    expect(pageText(<Privacy />)).not.toMatch(/6 months|six months/i);
  });

  it('the "never exact" lines carry the chat exception (Send current location sends exact GPS)', () => {
    const terms = pageText(<Terms />);
    const privacy = pageText(<Privacy />);
    for (const text of [terms, privacy]) {
      expect(text).toContain('Unless you choose to share it yourself in a chat, we never show your exact location to other members.');
      // Every "never exact" claim opens with the exception; no bare version is left.
      const claims = text.split(/we never show your exact location to other members/i).length - 1;
      const withException = text.split('Unless you choose to share it yourself in a chat, we never show your exact location to other members.').length - 1;
      expect(claims).toBeGreaterThan(0);
      expect(withException).toBe(claims);
    }
  });

  it('Privacy drops the stale waitlist and launch lines', () => {
    const text = pageText(<Privacy />);
    expect(text).not.toMatch(/waitlist/i);
    expect(text).not.toMatch(/launch readiness/i);
    expect(text).toContain('To send transactional emails and service notices.');
    expect(text).toContain('To improve product reliability and performance.');
  });

  it('post, chat and check-in locations are stated as Zoul worded them', () => {
    for (const text of [pageText(<Terms />), pageText(<Privacy />)]) {
      expect(text).toContain(
        'We keep it with the post until you delete the post or your account.',
      );
      expect(text).not.toContain('until the post is deleted');
      expect(text).toContain(
        'Locations you share in a chat are kept until that chat or your account is deleted, and check-ins are kept until your account is deleted.',
      );
    }
  });

  it('Terms 7.x has no waitlist, launch-date Premium or effective-at-launch wording', () => {
    const text = pageText(<Terms />);
    expect(text).not.toMatch(/waitlist/i);
    expect(text).not.toMatch(/public launch|Premium from launch|before launch|launch slips/i);
    expect(text).not.toContain('Effective:');
    expect(text).toContain('Members who registered before 1 October 2026 received 30 days of Premium free');
  });

  it('Terms 7.7: both kinds of unused Pride code stop after 31 October 2026', () => {
    const text = pageText(<Terms />);
    expect(text).toContain(
      'All other Pride codes work at register up to and including 31 October 2026 (23:59:59 UK time) and are refused from 1 November 2026.',
    );
    expect(text).toContain('Brighton Pride personal promo codes sent by email, and MenRush Pride invites (MENRUSH codes)');
    expect(text).toContain('register by 31 October 2026');
    expect(text).not.toContain('A personal code from an earlier email');
  });

  it('Terms and Privacy have no em dashes', () => {
    expect(pageText(<Terms />)).not.toContain('\u2014');
    expect(pageText(<Privacy />)).not.toContain('\u2014');
  });
});

