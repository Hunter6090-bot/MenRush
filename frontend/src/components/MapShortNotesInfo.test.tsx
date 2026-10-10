import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapShortNotesInfo } from './MapShortNotesInfo';

const SPOTS = 'Map spots include independent venues and outdoor locations. 18+ only.';
const PIN = 'Your pin is moved 80 to 320 m';

function renderNotes(
  props: { spotsText?: string | null; pinText?: string | null; spotsLayerOn?: boolean } = {},
) {
  return render(
    <div>
      <button type="button" data-testid="outside">
        Outside
      </button>
      <div data-testid="map-top-stack" className="relative">
        <MapShortNotesInfo spotsText={SPOTS} pinText={PIN} spotsLayerOn {...props} />
      </div>
    </div>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('MapShortNotesInfo dismiss', () => {
  it('closes on Escape and returns focus to the info button', async () => {
    const user = userEvent.setup();
    renderNotes();
    const info = screen.getByTestId('map-short-notes-info');
    await user.click(info);
    expect(screen.getByTestId('map-short-notes-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('hotspots-map-helper-copy')).toHaveTextContent(/18\+/);

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('map-short-notes-sheet')).toBeNull();
    expect(info).toHaveFocus();
  });

  it('closes on an outside tap and returns focus to the info button', async () => {
    const user = userEvent.setup();
    renderNotes();
    const info = screen.getByTestId('map-short-notes-info');
    await user.click(info);
    expect(screen.getByTestId('map-short-notes-sheet')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByTestId('map-short-notes-sheet')).toBeNull();
    await waitFor(() => expect(info).toHaveFocus());
  });
});

describe('MapShortNotesInfo unread dot', () => {
  it('shows the 18+ unread dot only when the Spots layer is on', () => {
    const { rerender } = render(
      <div data-testid="map-top-stack">
        <MapShortNotesInfo spotsText={SPOTS} spotsLayerOn={false} />
      </div>,
    );
    expect(screen.queryByTestId('map-short-notes-info')).toBeNull();
    expect(screen.queryByTestId('map-short-notes-dot')).toBeNull();

    rerender(
      <div data-testid="map-top-stack">
        <MapShortNotesInfo spotsText={SPOTS} spotsLayerOn />
      </div>,
    );
    expect(screen.getByTestId('map-short-notes-info')).toBeInTheDocument();
    expect(screen.getByTestId('map-short-notes-dot')).toBeInTheDocument();
  });
});
