import { beforeEach, describe, expect, it } from 'vitest';
import {
  homeToggleLabel,
  homeToggleTarget,
  homeViewToNearby,
  nearbyToHomeView,
  readHomeView,
  writeHomeView,
} from './homeView';

describe('homeView: map|list preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to map', () => {
    expect(readHomeView()).toBe('map');
  });

  it('persists map|list and mirrors NearbyView map|grid', () => {
    writeHomeView('list');
    expect(readHomeView()).toBe('list');
    expect(homeViewToNearby('list')).toBe('grid');
    expect(localStorage.getItem('menrush_nearby_view')).toBe('grid');

    writeHomeView('map');
    expect(readHomeView()).toBe('map');
    expect(homeViewToNearby('map')).toBe('map');
    expect(localStorage.getItem('menrush_nearby_view')).toBe('map');
  });

  it('migrates from legacy nearby grid preference', () => {
    localStorage.setItem('menrush_nearby_view', 'grid');
    expect(readHomeView()).toBe('list');
    expect(nearbyToHomeView('grid')).toBe('list');
  });

  it('toggle target is always the opposite view', () => {
    expect(homeToggleTarget('map')).toBe('list');
    expect(homeToggleLabel('map')).toBe('List');
    expect(homeToggleTarget('list')).toBe('map');
    expect(homeToggleLabel('list')).toBe('Map');
  });
});
