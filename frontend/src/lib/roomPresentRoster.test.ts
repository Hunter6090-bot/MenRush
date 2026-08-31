import { describe, expect, it } from 'vitest';
import {
  presentOthers,
  removePresentPerson,
  replacePresentRoster,
  upsertPresentPerson,
} from './roomPresentRoster';

describe('roomPresentRoster', () => {
  it('replacePresentRoster keeps present people only (no historical merge)', () => {
    const first = replacePresentRoster([
      { user_id: 'self', name: 'Self', photo_url: null },
      { user_id: 'alex', name: 'Alex', photo_url: '/a.jpg' },
      { user_id: 'bear', name: 'Bigbear', photo_url: null },
    ]);
    expect(first.map((p) => p.user_id).sort()).toEqual(['alex', 'bear', 'self']);

    const afterLeave = replacePresentRoster([
      { user_id: 'self', name: 'Self', photo_url: null },
    ]);
    expect(afterLeave).toHaveLength(1);
    expect(afterLeave[0].user_id).toBe('self');
    expect(afterLeave.find((p) => p.user_id === 'alex')).toBeUndefined();
  });

  it('upsert + remove track live join/leave', () => {
    let roster = replacePresentRoster([{ user_id: 'self', name: 'Self' }]);
    roster = upsertPresentPerson(roster, { user_id: 'alex', name: 'Quiet Fox', photo_url: '/t.jpg' });
    expect(roster.map((p) => p.name)).toEqual(['Quiet Fox', 'Self']);

    roster = removePresentPerson(roster, 'alex');
    expect(roster.map((p) => p.user_id)).toEqual(['self']);
  });

  it('presentOthers excludes self for the side list', () => {
    const roster = replacePresentRoster([
      { user_id: 'self', name: 'Self' },
      { user_id: 'peer', name: 'Peer' },
    ]);
    expect(presentOthers(roster, 'self').map((p) => p.user_id)).toEqual(['peer']);
  });
});
