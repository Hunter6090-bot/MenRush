import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapShortNotesInfo, mapNotesSheetMaxHeightPx, mapNotesSheetCeilingPx } from './MapShortNotesInfo';

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
      <button type="button" data-testid="map-pill-radius">
        Radius 5 miles
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

  it('does not fire the Radius click when an outside tap closes the sheet', async () => {
    const user = userEvent.setup();
    const onRadius = vi.fn();
    render(
      <div>
        <button type="button" data-testid="map-pill-radius" onClick={onRadius}>
          Radius 5 miles
        </button>
        <div data-testid="map-top-stack" className="relative">
          <MapShortNotesInfo spotsText={SPOTS} pinText={PIN} spotsLayerOn />
        </div>
      </div>,
    );
    await user.click(screen.getByTestId('map-short-notes-info'));
    expect(screen.getByTestId('map-short-notes-sheet')).toBeInTheDocument();
    await user.click(screen.getByTestId('map-pill-radius'));
    expect(screen.queryByTestId('map-short-notes-sheet')).toBeNull();
    expect(onRadius).not.toHaveBeenCalled();
  });

  it('does not swallow a later Radius tap after an outside drag closes the sheet', async () => {
    const user = userEvent.setup();
    const onRadius = vi.fn();
    render(
      <div>
        <button type="button" data-testid="outside">
          Outside
        </button>
        <button type="button" data-testid="map-pill-radius" onClick={onRadius}>
          Radius 5 miles
        </button>
        <div data-testid="map-top-stack" className="relative">
          <MapShortNotesInfo spotsText={SPOTS} pinText={PIN} spotsLayerOn />
        </div>
      </div>,
    );
    await user.click(screen.getByTestId('map-short-notes-info'));
    expect(screen.getByTestId('map-short-notes-sheet')).toBeInTheDocument();

    const outside = screen.getByTestId('outside');
    fireEvent.pointerDown(outside);
    fireEvent.pointerMove(outside);
    fireEvent.pointerUp(outside);
    expect(screen.queryByTestId('map-short-notes-sheet')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await user.click(screen.getByTestId('map-pill-radius'));
    expect(onRadius).toHaveBeenCalled();
  });
});

describe('MapShortNotesInfo unread dot', () => {
  it('shows the 18+ unread dot only when the Spots layer is on', () => {
    const { rerender } = render(
      <div data-testid="map-top-stack">
        <MapShortNotesInfo spotsText={SPOTS} spotsLayerOn={false} />
      </div>,
    );
    expect(screen.getByTestId('map-short-notes-info')).toBeInTheDocument();
    expect(screen.queryByTestId('map-short-notes-dot')).toBeNull();

    rerender(
      <div data-testid="map-top-stack">
        <MapShortNotesInfo spotsText={SPOTS} spotsLayerOn />
      </div>,
    );
    expect(screen.getByTestId('map-short-notes-info')).toBeInTheDocument();
    expect(screen.getByTestId('map-short-notes-dot')).toBeInTheDocument();
  });

  it('keeps the info button after both notes are dismissed so 18+ can be reread', async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(screen.getByTestId('map-short-notes-info'));
    await user.click(screen.getByTestId('hotspots-map-helper-dismiss'));
    await user.click(screen.getByTestId('map-privacy-note-close'));
    expect(screen.getByTestId('map-short-notes-info')).toBeInTheDocument();
    expect(screen.queryByTestId('map-short-notes-dot')).toBeNull();

    await user.click(screen.getByTestId('map-short-notes-info'));
    expect(screen.getByTestId('hotspots-map-helper-copy')).toHaveTextContent(/18\+/);
  });
});

describe('mapNotesSheetMaxHeightPx', () => {
  it('uses the tab when it crosses the sheet, and ignores side chrome', () => {
    const ceiling = mapNotesSheetCeilingPx({
      mapBottom: 326,
      sheetLeft: 214,
      sheetRight: 630,
      tab: { left: 0, right: 844, top: 319 },
      pulse: { left: 764, right: 828, top: 222 },
      dock: { left: 12, right: 56, top: 234 },
    });
    expect(ceiling).toBe(319);
    expect(mapNotesSheetMaxHeightPx(221, ceiling)).toBe(90);
  });
});
