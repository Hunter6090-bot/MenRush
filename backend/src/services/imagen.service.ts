import https from 'https';

// gemini-2.5-flash-image supports generateContent with responseModalities IMAGE.
// Requires a paid Google AI Studio plan (billing enabled).
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

export interface ImagenResult {
  imageBase64: string;
  mimeType: string;
}

/**
 * Generate an image using the Gemini image generation model via the REST API.
 *
 * Uses gemini-2.0-flash-preview-image-generation which is available on the
 * free tier of Google AI Studio. The generateContent endpoint is used with
 * responseModalities set to include "IMAGE".
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
 */
export async function generateImage(
  prompt: string,
  numberOfImages: number = 1
): Promise<ImagenResult[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  // Clamp between 1 and 4
  const count = Math.max(1, Math.min(4, numberOfImages));

  const results: ImagenResult[] = [];

  // The generateContent endpoint returns one image per request, so we loop
  // for multiple images.
  for (let i = 0; i < count; i++) {
    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`;
    const data = await httpPost(url, requestBody);

    // Response shape:
    // { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }
    const parts: any[] =
      (data as any)?.candidates?.[0]?.content?.parts ?? [];

    const imagePart = parts.find((p: any) => p.inlineData);
    if (!imagePart) {
      throw new Error('Gemini image API returned no image in response');
    }

    results.push({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
    });
  }

  if (!results.length) {
    throw new Error('Image generation returned no results');
  }

  return results;
}

function httpPost(url: string, body: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (res.statusCode && res.statusCode >= 400) {
            const msg =
              parsed?.error?.message ?? `HTTP ${res.statusCode}: ${raw}`;
            reject(new Error(msg));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Failed to parse response: ${raw}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
