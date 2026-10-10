import { describe, expect, it } from 'vitest';
import { getParamIgnoreCase, pickTrackingParams, withTrackingParams } from './trackingParams';

describe('trackingParams', () => {
  it('keeps ref and every utm_* key, including utm_term and utm_id, and drops the rest', () => {
    expect(
      pickTrackingParams(
        '?utm_source=news&utm_medium=email&utm_campaign=oct&utm_content=hero&utm_term=sauna&utm_id=c42&ref=PETE1&session=abc&foo=1',
      ).toString(),
    ).toBe('utm_source=news&utm_medium=email&utm_campaign=oct&utm_content=hero&utm_term=sauna&utm_id=c42&ref=PETE1');
  });

  it('normalises uppercase and mixed-case keys to lowercase', () => {
    expect(pickTrackingParams('?UTM_Source=x&REF=Y&Utm_Term=t&UTM_ID=9').toString()).toBe(
      'utm_source=x&ref=Y&utm_term=t&utm_id=9',
    );
  });

  it('first non-empty value wins when a key repeats in different case', () => {
    expect(pickTrackingParams('?ref=&REF=first&ref=second').toString()).toBe('ref=first');
  });

  it('reads a param ignoring key case', () => {
    expect(getParamIgnoreCase(new URLSearchParams('?REF=abc'), 'ref')).toBe('abc');
    expect(getParamIgnoreCase(new URLSearchParams('?foo=1'), 'ref')).toBeNull();
  });

  it('appends tracking params to a path that already has a query, without overriding it', () => {
    expect(withTrackingParams('/register?invite=MENRUSHABCD1234', '?REF=x&utm_id=1&foo=2')).toBe(
      '/register?invite=MENRUSHABCD1234&ref=x&utm_id=1',
    );
    expect(withTrackingParams('/register', '')).toBe('/register');
  });
});
