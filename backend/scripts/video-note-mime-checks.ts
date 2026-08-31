/**
 * Proves the video-note multipart MIME reject and the fixed upload path.
 *
 * Bug: MediaRecorder Blob.type like `video/webm;codecs=vp8,opus` is serialised
 * by FormData with an unquoted codecs list. Busboy collapses that Content-Type
 * to `text/plain`, and MenRush's message allowlist rejects with
 * "Unsupported upload type".
 *
 * Fix: client strips to base MIME before append; API also normalises.
 *
 * Run: npx ts-node scripts/video-note-mime-checks.ts
 */
import assert from 'assert';
import express from 'express';
import multer from 'multer';
import {
  allowedUpload,
  normalizeUploadMime,
  uploadFileFilter,
} from '../src/security/uploads';
import { errorHandler } from '../src/middleware/auth';

type Case = { name: string; run: () => void | Promise<void> };
const cases: Case[] = [];
function test(name: string, run: Case['run']) {
  cases.push({ name, run });
}

/** Mimic frontend blobForUpload — base MIME only. */
function blobForUpload(file: Blob): Blob {
  const base = (file.type || '').split(';')[0].trim().toLowerCase();
  if (!base || file.type === base) return file;
  return new Blob([file], { type: base });
}

function makeApp() {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: uploadFileFilter('message'),
  });
  app.post('/media', upload.single('media'), (req, res) => {
    res.json({ mimetype: req.file?.mimetype, size: req.file?.size });
  });
  app.use(errorHandler);
  return app;
}

test('document: raw MediaRecorder codec MIME becomes text/plain and is rejected', async () => {
  const app = makeApp();
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const fd = new FormData();
    fd.append(
      'media',
      new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], {
        type: 'video/webm;codecs=vp8,opus',
      }),
      'video-1.webm',
    );
    const res = await fetch(`http://127.0.0.1:${port}/media`, { method: 'POST', body: fd });
    const body = (await res.json()) as { error?: string; mimetype?: string };
    assert.equal(res.status, 400);
    assert.match(String(body.error), /Unsupported upload type/);
    assert.match(String(body.error), /text\/plain/);
  } finally {
    server.close();
  }
});

test('desktop/Android path: cleaned video/webm uploads', async () => {
  const app = makeApp();
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const raw = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01])], {
      type: 'video/webm;codecs=vp8,opus',
    });
    const fd = new FormData();
    fd.append('media', blobForUpload(raw), 'video-desktop.webm');
    const res = await fetch(`http://127.0.0.1:${port}/media`, { method: 'POST', body: fd });
    const body = (await res.json()) as { error?: string; mimetype?: string };
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.mimetype, 'video/webm');
  } finally {
    server.close();
  }
});

test('iPhone/Safari path: cleaned video/mp4 uploads', async () => {
  const app = makeApp();
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const ftyp = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00,
    ]);
    const raw = new Blob([ftyp], {
      type: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    });
    const fd = new FormData();
    fd.append('media', blobForUpload(raw), 'video-iphone.mp4');
    const res = await fetch(`http://127.0.0.1:${port}/media`, { method: 'POST', body: fd });
    const body = (await res.json()) as { error?: string; mimetype?: string };
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.mimetype, 'video/mp4');
  } finally {
    server.close();
  }
});

test('reject reasons name mime (not container/codec/size) for true mime rejects', () => {
  assert.equal(normalizeUploadMime('video/quicktime'), 'video/quicktime');
  assert.equal(allowedUpload('video/quicktime', 'message'), false);
  assert.equal(allowedUpload('application/octet-stream', 'message'), false);
  assert.equal(allowedUpload('video/webm', 'message'), true);
  assert.equal(allowedUpload('video/mp4', 'message'), true);
});

async function main() {
  let failed = 0;
  for (const c of cases) {
    try {
      await c.run();
      console.log(`ok - ${c.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL - ${c.name}`);
      console.error(err);
    }
  }
  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log(`All ${cases.length} video-note mime checks passed`);
}

void main();
