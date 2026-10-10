/**
 * Test helper: resolve theme-token colour classes against menrush-tokens.css for light and dark
 * and compute WCAG contrast for rendered elements (jsdom has no real CSS, so we resolve classes).
 * Test files read the CSS and call loadThemeTokens(css) first (kept out of app tsc: no node types here).
 */
export type Theme = 'dark' | 'light';
type RGBA = [number, number, number, number];

function block(css: string, startMarker: string): Record<string, string> {
  const start = css.indexOf(startMarker);
  if (start < 0) throw new Error(`missing ${startMarker}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const TOKENS: Record<Theme, Record<string, string>> = { dark: {}, light: {} };

/** Parse :root (dark default) and html.theme-light token blocks from menrush-tokens.css. */
export function loadThemeTokens(css: string): void {
  const root = block(css, ':root {');
  TOKENS.dark = root;
  TOKENS.light = { ...root, ...block(css, 'html.theme-light {') };
}

function resolveVars(value: string, theme: Theme, depth = 0): string {
  if (depth > 12) throw new Error(`var loop: ${value}`);
  const next = value.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, name: string, fb?: string) => {
    const v = TOKENS[theme][name] ?? fb;
    if (v === undefined) throw new Error(`unknown token ${name}`);
    return v;
  });
  return next === value ? value : resolveVars(next, theme, depth + 1);
}

function parseColor(raw: string): RGBA {
  const v = raw.trim();
  if (v === 'transparent') return [0, 0, 0, 0];
  const mix = v.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*transparent\)$/);
  if (mix) {
    const c = parseColor(mix[1]);
    return [c[0], c[1], c[2], c[3] * (Number(mix[2]) / 100)];
  }
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((x) => x + x).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgb = v.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const p = rgb[1].split(',').map((x) => Number(x.trim()));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`unparsed colour ${v}`);
}

const COLOUR_VALUE = /^(var\(|#|rgba?\(|color-mix\()/;

/** Colour from an arbitrary `text-[..]` or `bg-[..]` class. `variant` picks e.g. `hover:` classes. */
function arbitraryColour(el: Element, prefix: 'text' | 'bg', variant = ''): string | null {
  const want = variant ? `${variant}:` : '';
  for (const cls of (el.getAttribute('class') ?? '').split(/\s+/)) {
    if (variant ? !cls.startsWith(want) : cls.includes(':')) continue;
    const m = cls.slice(want.length).match(new RegExp(`^${prefix}-\\[(.+)\\]$`));
    if (m && COLOUR_VALUE.test(m[1])) return m[1].replace(/_/g, ' ');
  }
  return null;
}

function over(top: RGBA, under: RGBA): RGBA {
  const a = top[3] + under[3] * (1 - top[3]);
  if (a === 0) return [0, 0, 0, 0];
  const ch = (i: number) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
  return [ch(0), ch(1), ch(2), a];
}

export interface ContrastOptions {
  /** Use the element's own `hover:` background (for example a menu row hover state). */
  hover?: boolean;
}

function backgroundOf(el: Element, theme: Theme, opts: ContrastOptions): RGBA {
  const layers: RGBA[] = [];
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = (opts.hover && n === el ? arbitraryColour(n, 'bg', 'hover') : null) ?? arbitraryColour(n, 'bg');
    if (bg) {
      const c = parseColor(resolveVars(bg, theme));
      layers.push(c);
      if (c[3] >= 1) break;
    }
  }
  // html and body paint var(--nn-bg) underneath everything.
  if (!layers.length || layers[layers.length - 1][3] < 1) layers.push(parseColor(resolveVars('var(--nn-bg)', theme)));
  return layers.reduceRight<RGBA>((acc, layer) => over(layer, acc), [0, 0, 0, 0]);
}

function foregroundOf(el: Element, theme: Theme): RGBA {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const fg = arbitraryColour(n, 'text');
    if (fg) return parseColor(resolveVars(fg, theme));
  }
  throw new Error(`no text colour for ${el.outerHTML.slice(0, 80)}`);
}

function luminance([r, g, b]: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(el: Element, theme: Theme, opts: ContrastOptions = {}): number {
  const bg = backgroundOf(el, theme, opts);
  const fg = over(foregroundOf(el, theme), bg);
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const HARDCODED = /^(?:[a-z-]+:)*(?:text|bg|border)-\[(?:#|rgba?\()|^(?:[a-z-]+:)*(?:text|bg|border)-(?:white|black)\b/;

export function hardcodedColourClasses(root: Element, skip: (el: Element) => boolean = () => false): string[] {
  const found: string[] = [];
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    if (skip(el)) continue;
    for (const cls of (el.getAttribute('class') ?? '').split(/\s+/)) {
      if (HARDCODED.test(cls)) found.push(cls);
    }
  }
  return found;
}
