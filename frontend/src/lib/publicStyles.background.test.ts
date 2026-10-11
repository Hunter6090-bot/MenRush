// @vitest-environment node
/**
 * The sign-in card must actually get its background. `bg-[#1E1508]/96` looked right but
 * Tailwind 3 generates no CSS for it (96 is not an opacity step), so the card was see-through.
 * This builds the real Tailwind CSS for the class string and checks the rule that ships.
 */
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import config from '../../tailwind.config.js';
import { publicPanelClass } from './publicStyles';

async function cssFor(classes: string): Promise<string> {
  const result = await postcss([
    tailwind({ ...config, content: [{ raw: `<div class="${classes}"></div>` }], corePlugins: { preflight: false } }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

const lum = (r: number, g: number, b: number) => {
  const c = [r, g, b].map((v) => v / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

describe('sign-in card background', () => {
  it('renders background-color rgba(30,21,8,0.96)', async () => {
    const css = await cssFor(publicPanelClass);
    expect(css).toMatch(/background-color:\s*rgba\(30,\s*21,\s*8,\s*0\.96\)/);
  });

  it('every background class on the card produces CSS (no silent no-op)', async () => {
    const bgClasses = publicPanelClass.split(/\s+/).filter((c) => c.startsWith('bg-'));
    expect(bgClasses.length).toBeGreaterThan(0);
    for (const cls of bgClasses) {
      expect(await cssFor(cls), cls).toContain('background-color');
    }
  });

  it('the old class really was a no-op (guards the reason for this fix)', async () => {
    expect(await cssFor('bg-[#1E1508]/96')).not.toContain('background-color');
  });

  it('error text stays readable on the card over the night page (4.5:1+)', () => {
    // 96% #1E1508 over #0D0A06, against the card's error colour #D96A52 (--nn-danger-light).
    const mix = (a: number, b: number) => Math.round(a * 0.96 + b * 0.04);
    const card = lum(mix(0x1e, 0x0d), mix(0x15, 0x0a), mix(0x08, 0x06));
    const text = lum(0xd9, 0x6a, 0x52);
    expect((text + 0.05) / (card + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
