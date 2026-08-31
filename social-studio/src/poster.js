/**
 * Local MenRush poster preview — SVG only, no paid APIs or secrets.
 * Brand tone: dark copper, direct, UK launch 1 October 2026.
 * Does not modify or re-encode the official logo PNG.
 */

import { saveDraftImage } from './media-store.js';

const FORMAT_SIZE = {
  feed: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  reel: { w: 1080, h: 1920 },
  post: { w: 1200, h: 675 },
};

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapLines(text, maxChars, maxLines) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) {
    return ['Type what you want', 'on the poster.'];
  }
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = next;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (words.join(' ').length > lines.join(' ').length) {
    const last = lines[lines.length - 1] || '';
    lines[lines.length - 1] = `${last.replace(/\s+\S*$/, '')}…`.trim();
  }
  return lines.slice(0, maxLines);
}

/**
 * Build an SVG poster from the owner's prompt.
 * @param {{ prompt: string, format?: string, platform?: string }} opts
 */
export function buildPosterSvg({ prompt, format = 'feed', platform = 'instagram' }) {
  const size = FORMAT_SIZE[format] || FORMAT_SIZE.feed;
  const { w, h } = size;
  const isTall = h > w;
  const maxChars = isTall ? 22 : 28;
  const maxLines = isTall ? 8 : 5;
  const lines = wrapLines(prompt, maxChars, maxLines);
  const titleSize = isTall ? 64 : 52;
  const lineH = titleSize * 1.2;
  const blockH = lines.length * lineH;
  const textY = Math.round(h * (isTall ? 0.42 : 0.45) - blockH / 2);

  const formatLabel =
    format === 'story'
      ? 'STORY'
      : format === 'reel'
        ? 'REEL'
        : format === 'feed'
          ? 'FEED'
          : String(platform || 'POST').toUpperCase();

  const textNodes = lines
    .map((line, i) => {
      const y = textY + i * lineH;
      return `<text x="${w / 2}" y="${y}" text-anchor="middle" fill="#F0E0C0" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="600">${escapeXml(line)}</text>`;
    })
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="28%" r="55%">
      <stop offset="0%" stop-color="#C4832A" stop-opacity="0.28"/>
      <stop offset="55%" stop-color="#C4832A" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#0D0A06" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#16110A"/>
      <stop offset="100%" stop-color="#0D0A06"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <rect x="48" y="48" width="${w - 96}" height="${h - 96}" fill="none" stroke="rgba(196,131,42,0.35)" stroke-width="2"/>
  <text x="${w / 2}" y="${isTall ? 140 : 110}" text-anchor="middle" fill="#C4832A" font-family="Avenir Next, Segoe UI, sans-serif" font-size="22" letter-spacing="0.28em">${escapeXml(formatLabel)}</text>
  ${textNodes}
  <text x="${w / 2}" y="${h - (isTall ? 160 : 100)}" text-anchor="middle" fill="#F0E0C0" font-family="Georgia, serif" font-size="36" font-weight="600" letter-spacing="0.12em">MENRUSH</text>
  <text x="${w / 2}" y="${h - (isTall ? 110 : 62)}" text-anchor="middle" fill="rgba(240,224,192,0.65)" font-family="Avenir Next, Segoe UI, sans-serif" font-size="20" letter-spacing="0.08em">Opens 1 October 2026 · UK first</text>
</svg>`;
}

/**
 * Persist a local poster SVG for a draft. No external network.
 */
export function generateLocalPoster(draftId, { prompt, format, platform }) {
  const text = (prompt || '').trim();
  if (!text) throw new Error('Type a prompt for the poster first.');
  const svg = buildPosterSvg({ prompt: text, format, platform });
  const buffer = Buffer.from(svg, 'utf8');
  return saveDraftImage(draftId, {
    buffer,
    mimeType: 'image/svg+xml',
    filename: `${draftId}.svg`,
    source: 'local-poster',
  });
}
