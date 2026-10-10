import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * There is no waitlist: MenRush is open. These guards stop the old waitlist
 * paths saying otherwise.
 */
const ROOT = resolve(__dirname, '../../..');

describe('retired waitlist paths', () => {
  it('send-invite-reminders.ts is removed and nothing points at it', () => {
    expect(existsSync(resolve(ROOT, 'backend/src/scripts/send-invite-reminders.ts'))).toBe(false);
    const pkg = readFileSync(resolve(ROOT, 'backend/package.json'), 'utf8');
    expect(pkg).not.toMatch(/invite-reminders/);
    const workflows = resolve(ROOT, '.github/workflows');
    for (const f of readdirSync(workflows)) {
      expect(readFileSync(resolve(workflows, f), 'utf8')).not.toMatch(/invite-reminders/);
    }
    for (const f of ['railway.json', 'backend/railway.json']) {
      const p = resolve(ROOT, f);
      if (existsSync(p)) expect(readFileSync(p, 'utf8')).not.toMatch(/invite-reminders/);
    }
  });

  describe('bare POST /api/waitlist reply', () => {
    const server = readFileSync(resolve(ROOT, 'backend/src/server.ts'), 'utf8');
    const start = server.indexOf("app.post('/api/waitlist'");
    const handler = server.slice(start, server.indexOf('\n});', start));

    it('server.ts comment names this guard file', () => {
      expect(server).toContain('guarded by frontend/src/test/retiredWaitlistPaths.test.ts');
    });

    it('handler is found', () => {
      expect(start).toBeGreaterThan(-1);
      expect(handler).toMatch(/message:/);
    });

    it('never says "on the list" or mentions a waitlist or invite', () => {
      const messages = handler.match(/message:[\s\S]*?\n {4}\}\);/)?.[0] ?? '';
      expect(messages).not.toBe('');
      expect(messages).not.toMatch(/on the list/i);
      expect(messages).not.toMatch(/waitlist/i);
      expect(messages).not.toMatch(/invite/i);
    });

    it('points people at sign-up on menrush.com', () => {
      expect(handler).toContain("'Thanks. MenRush is open now, so you can sign up free at menrush.com.'");
      expect(handler).toContain(
        "'We already have this email. MenRush is open now, so you can sign up free at menrush.com.'",
      );
    });
  });

  describe('closed Pride/Brighton claim paths', () => {
    const promo = readFileSync(resolve(ROOT, 'backend/src/services/promo.service.ts'), 'utf8');
    const pride = readFileSync(resolve(ROOT, 'backend/src/services/prideInvite.service.ts'), 'utf8');
    const campaigns = readFileSync(resolve(ROOT, 'backend/src/routes/campaigns.ts'), 'utf8');

    it('dead Brighton sendPromoEmail is gone', () => {
      expect(promo).not.toMatch(/function sendPromoEmail/);
      expect(promo).not.toMatch(/Brighton Pride<br>offer is here/);
    });

    it("Pride email footer reads '21 to 31 August', no hyphen", () => {
      expect(pride).not.toMatch(/21-31/);
      expect(pride).toMatch(/21 to 31&nbsp;August&nbsp;2026/);
      expect(pride).toMatch(/21 to 31 August 2026/);
    });

    it('old claim replies point at sign-up, not /pride', () => {
      const closed = campaigns.slice(campaigns.indexOf("err.message === 'campaign_closed'"));
      const window = campaigns.slice(campaigns.indexOf("err.message === 'issue_window_closed'"));
      for (const block of [closed.slice(0, 400), window.slice(0, 400)]) {
        expect(block).not.toMatch(/\/pride/);
        expect(block).toMatch(/sign up/i);
        expect(block).toMatch(/menrush\.com/);
      }
      expect(closed.slice(0, 400)).toMatch(/redirect: '\/register'/);
      expect(window.slice(0, 400)).toMatch(/register by 31 October, when all Pride codes end/);
    });
  });
});

