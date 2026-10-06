import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGridPhotoSrc } from './nearbyPhotoSrc';

describe('useGridPhotoSrc — legacy defaults are empty (Brand placeholder)', () => {
  it('generic /avatars/* → empty phase, no src', () => {
    const { result } = renderHook(() => useGridPhotoSrc('/avatars/generic/05.svg', 40));
    expect(result.current.phase).toBe('empty');
    expect(result.current.src).toBeUndefined();
  });

  it('empty → empty phase', () => {
    const { result } = renderHook(() => useGridPhotoSrc('', 40));
    expect(result.current.phase).toBe('empty');
  });

  it('real /uploads stays a loading upload (media lock)', () => {
    const { result } = renderHook(() => useGridPhotoSrc('/uploads/profiles/a.jpg', 40));
    expect(result.current.phase).toBe('loading');
  });
});
