import fs from 'fs/promises';
import { InferenceClient } from '@huggingface/inference';
import sharp from 'sharp';
import { faceMatchService } from './face-match.service';

export type IdPrecheckTemplate =
  | 'passport'
  | 'driving_license_front'
  | 'driving_license_back';

export type IdPrecheckCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type IdPrecheckResult = {
  acceptable: boolean;
  source: 'huggingface' | 'local';
  checks: IdPrecheckCheck[];
  message: string;
  rejectionReasons: string[];
};

const DOC_LABELS = [
  'a government issued identity document',
  'a passport or driving licence card',
  'an official ID card with printed text',
];

const REJECT_LABELS = [
  'a photo of a phone or computer screen',
  'a blurry unusable photograph',
  'a random object or scenery',
];

const CLIP_MODEL =
  process.env.HF_ID_PRECHECK_CLIP_MODEL || 'openai/clip-vit-base-patch32';
const OCR_MODEL =
  process.env.HF_ID_PRECHECK_OCR_MODEL || 'microsoft/trocr-base-printed';

function hfToken(): string | null {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  return token?.trim() || null;
}

function requiresFace(template: IdPrecheckTemplate): boolean {
  return template !== 'driving_license_back';
}

async function analyzeImageQuality(filePath: string): Promise<{
  width: number;
  height: number;
  brightness: number;
  sharpness: number;
}> {
  const image = sharp(filePath).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const stats = await image.stats();
  const brightness =
    stats.channels.reduce((sum, channel) => sum + channel.mean, 0) /
    Math.max(stats.channels.length, 1);

  const { data, info } = await image
    .resize(160, 160, { fit: 'inside' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const size = info.width;
  const gray = new Float32Array(data);
  let sharpness = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const lap =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - size] +
        gray[i + size];
      sharpness += lap * lap;
    }
  }
  sharpness /= Math.max(1, (size - 2) * (size - 2));

  return { width, height, brightness, sharpness };
}

function scoreForLabel(
  results: { label: string; score: number }[],
  matchers: string[],
): number {
  let best = 0;
  for (const item of results) {
    const label = item.label.toLowerCase();
    if (matchers.some((matcher) => label.includes(matcher))) {
      best = Math.max(best, item.score);
    }
  }
  return best;
}

async function runClipCheck(filePath: string): Promise<{
  docScore: number;
  screenScore: number;
  blurryScore: number;
}> {
  const token = hfToken();
  if (!token) {
    throw new Error('hf_token_missing');
  }

  const buffer = await fs.readFile(filePath);
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  const client = new InferenceClient(token);

  const results = await client.zeroShotImageClassification({
    model: CLIP_MODEL,
    inputs: { image: blob },
    parameters: {
      candidate_labels: [...DOC_LABELS, ...REJECT_LABELS],
    },
  });

  const normalized = results.map((item) => ({
    label: item.label,
    score: item.score,
  }));

  return {
    docScore: Math.max(
      scoreForLabel(normalized, ['identity document', 'passport', 'driving licence', 'id card']),
      0,
    ),
    screenScore: scoreForLabel(normalized, ['phone', 'computer screen']),
    blurryScore: scoreForLabel(normalized, ['blurry']),
  };
}

async function runOcrCheck(filePath: string): Promise<string> {
  const token = hfToken();
  if (!token) {
    throw new Error('hf_token_missing');
  }

  const buffer = await fs.readFile(filePath);
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  const client = new InferenceClient(token);

  const result = await client.imageToText({
    model: OCR_MODEL,
    data: blob,
  });

  return (result.generated_text || '').trim();
}

function readableTextScore(text: string): number {
  return (text.match(/[A-Za-z0-9]/g) || []).length;
}

export const idPrecheckService = {
  async check(filePath: string, template: IdPrecheckTemplate): Promise<IdPrecheckResult> {
    const checks: IdPrecheckCheck[] = [];
    const rejectionReasons: string[] = [];
    let usedHf = false;

    const quality = await analyzeImageQuality(filePath);

    const resolutionOk = quality.width >= 640 && quality.height >= 480;
    checks.push({
      id: 'resolution',
      label: 'Image resolution',
      passed: resolutionOk,
      detail: resolutionOk
        ? `${quality.width}×${quality.height}`
        : 'Scan is too small — move closer.',
    });
    if (!resolutionOk) {
      rejectionReasons.push('Image is too small. Move closer and rescan.');
    }

    const brightnessOk = quality.brightness >= 45 && quality.brightness <= 220;
    checks.push({
      id: 'lighting',
      label: 'Lighting',
      passed: brightnessOk,
      detail: brightnessOk
        ? 'Lighting looks acceptable'
        : quality.brightness < 45
          ? 'Too dark — use better light.'
          : 'Too bright — reduce glare.',
    });
    if (!brightnessOk) {
      rejectionReasons.push(
        quality.brightness < 45
          ? 'Too dark. Move to better light and rescan.'
          : 'Too much glare. Tilt the ID slightly and rescan.',
      );
    }

    const sharpnessOk = quality.sharpness >= 90;
    checks.push({
      id: 'sharpness',
      label: 'Sharpness',
      passed: sharpnessOk,
      detail: sharpnessOk ? 'Text should be readable' : 'Image is blurry — hold steady.',
    });
    if (!sharpnessOk) {
      rejectionReasons.push('Image is blurry. Hold steady and rescan.');
    }

    if (requiresFace(template)) {
      const face = await faceMatchService.detectFace(filePath);
      const faceOk = face.engineAvailable ? face.found : true;
      checks.push({
        id: 'id_photo',
        label: 'Photo on ID',
        passed: faceOk,
        detail: !face.engineAvailable
          ? 'Face check skipped (engine unavailable)'
          : face.found
            ? 'Portrait detected on document'
            : 'No face found on the ID — show the photo side.',
      });
      if (face.engineAvailable && !face.found) {
        rejectionReasons.push('We could not find a portrait on your ID. Show the photo side.');
      }
    }

    const token = hfToken();
    if (token) {
      try {
        const clip = await runClipCheck(filePath);
        usedHf = true;

        const documentOk =
          clip.docScore >= 0.2 &&
          clip.docScore >= clip.screenScore + 0.04 &&
          clip.docScore >= clip.blurryScore;
        checks.push({
          id: 'document_type',
          label: 'Government ID detected',
          passed: documentOk,
          detail: documentOk
            ? 'Looks like a real identity document'
            : 'This does not look like a government ID.',
        });
        if (!documentOk) {
          rejectionReasons.push('This does not look like a government ID. Use your real passport or licence.');
        }

        const screenOk = clip.screenScore < 0.3 || clip.docScore > clip.screenScore + 0.08;
        checks.push({
          id: 'not_screen',
          label: 'Not a screen photo',
          passed: screenOk,
          detail: screenOk
            ? 'Not detected as a phone/screen photo'
            : 'Looks like a photo of a screen — scan the physical card.',
        });
        if (!screenOk) {
          rejectionReasons.push('Do not photograph a screen. Hold your physical ID to the camera.');
        }
      } catch (err) {
        checks.push({
          id: 'document_type',
          label: 'Document review',
          passed: true,
          detail: 'Additional checks will run during review',
        });
        checks.push({
          id: 'not_screen',
          label: 'Physical document review',
          passed: true,
          detail: 'Additional checks will run during review',
        });
      }

      try {
        const ocrText = await runOcrCheck(filePath);
        usedHf = true;
        const textScore = readableTextScore(ocrText);
        const textOk = textScore >= 8;
        checks.push({
          id: 'readable_text',
          label: 'Readable text',
          passed: textOk,
          detail: textOk
            ? 'Printed text detected on the document'
            : 'Could not read enough text — improve lighting and alignment.',
        });
        if (!textOk) {
          rejectionReasons.push('Text on the ID is not readable. Align the card and rescan.');
        }
      } catch (err) {
        checks.push({
          id: 'readable_text',
          label: 'Document text review',
          passed: true,
          detail: 'Additional checks will run during review',
        });
      }
    } else {
      checks.push({
        id: 'document_type',
        label: 'Document review',
        passed: true,
        detail: 'Additional checks will run during review',
      });
      checks.push({
        id: 'not_screen',
        label: 'Physical document review',
        passed: true,
        detail: 'Additional checks will run during review',
      });
      checks.push({
        id: 'readable_text',
        label: 'Document text review',
        passed: true,
        detail: 'Additional checks will run during review',
      });
    }

    const acceptable = rejectionReasons.length === 0;

    const message = acceptable
      ? usedHf
        ? 'ID scan looks acceptable.'
        : 'Initial quality checks passed. Confirm to continue.'
      : rejectionReasons[0] || 'This scan is not acceptable. Please rescan.';

    return {
      acceptable,
      source: usedHf ? 'huggingface' : 'local',
      checks,
      message,
      rejectionReasons,
    };
  },
};
