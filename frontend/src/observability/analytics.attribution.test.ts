import { beforeEach, describe, expect, it } from 'vitest';
import { getAttributionParams } from './analytics';

describe('getAttributionParams', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('records utm_term and utm_id and reads keys case-insensitively', () => {
    window.history.replaceState(null, '', '/?UTM_Source=news&utm_medium=email&Utm_Term=sauna&UTM_ID=c42&REF=x');
    expect(getAttributionParams()).toEqual({
      utm_source: 'news',
      utm_medium: 'email',
      utm_term: 'sauna',
      utm_id: 'c42',
    });
    window.history.replaceState(null, '', '/');
  });
});
