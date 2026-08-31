import { describe, it, expect, afterEach } from 'vitest';
import {
  ANDROID_TWA_PACKAGE_ID,
  ANDROID_PLAY_STORE_URL,
  isAndroidChrome,
  isAndroidPhone,
} from './androidTwa';

describe('androidTwa helpers', () => {
  const originalUa = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => originalUa,
    });
  });

  it('exposes the Play package id used by Bubblewrap / asset links', () => {
    expect(ANDROID_TWA_PACKAGE_ID).toBe('com.menrush.app');
    expect(ANDROID_PLAY_STORE_URL).toContain(ANDROID_TWA_PACKAGE_ID);
  });

  it('detects Android Chrome phones', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    expect(isAndroidPhone()).toBe(true);
    expect(isAndroidChrome()).toBe(true);
  });

  it('does not treat iPhone as Android Chrome', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    expect(isAndroidPhone()).toBe(false);
    expect(isAndroidChrome()).toBe(false);
  });
});
