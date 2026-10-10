/**
 * Render every welcome email to plain HTML files for a quick look in a browser.
 *
 * Run from backend/:
 *   npm run render:welcome-emails            # writes to $TMPDIR/menrush-welcome-email-renders
 *   npm run render:welcome-emails -- ./out   # or a folder of your choice
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { renderWelcomeTemplates } from './welcome-email-templates';

const outDir = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), 'menrush-welcome-email-renders'));
fs.mkdirSync(outDir, { recursive: true });

for (const { name, html } of renderWelcomeTemplates()) {
  const file = name.replace(/ \(.*\)$/, '').replace(/[^a-z0-9.-]+/gi, '_').replace(/_?\.html$/, '') + '.html';
  fs.writeFileSync(path.join(outDir, file), html);
  console.log(path.join(outDir, file));
}
