import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Terms } from './Terms';
import { Privacy } from './Privacy';

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
      'We never show your exact location to other members. They see an approximate position, moved by your Discretion setting, and distances rounded to "under 1 mile" or whole miles. Members who choose Ghost or hidden mode don\'t appear on the map.',
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
      'Precise location from your device, with your permission, when you use the map and nearby discovery. We use it to work out an approximate position and rounded distance that other members can see. We never show your exact location to other members.',
    );
    expect(text).toContain('Distances are shown rounded, as "under 1 mile" or in whole miles.');
    expect(text).not.toContain('privacy-bucketed');
  });
});
