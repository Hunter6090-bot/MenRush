import { describe, expect, it } from 'vitest';
import {
  CHAT_IMAGE_VIEWER_FRAME,
  CHAT_IMAGE_VIEWER_FRAME_BOUNDS,
} from './chatImageViewerFrame';

describe('chatImageViewerFrame', () => {
  it('uses a phone-safe standard box (not native resolution)', () => {
    expect(CHAT_IMAGE_VIEWER_FRAME.width).toContain('90vw');
    expect(CHAT_IMAGE_VIEWER_FRAME.height).toContain('75vh');
    expect(CHAT_IMAGE_VIEWER_FRAME.maxWidth).toBe('90vw');
    expect(CHAT_IMAGE_VIEWER_FRAME.maxHeight).toBe('75vh');
  });

  it('bounds keep the frame under ~90vw × ~80vh', () => {
    expect(CHAT_IMAGE_VIEWER_FRAME_BOUNDS.maxWidthRatio).toBeLessThanOrEqual(0.9);
    expect(CHAT_IMAGE_VIEWER_FRAME_BOUNDS.maxHeightRatio).toBeLessThanOrEqual(0.8);
    expect(CHAT_IMAGE_VIEWER_FRAME_BOUNDS.minWidthPx).toBeGreaterThanOrEqual(160);
  });
});
