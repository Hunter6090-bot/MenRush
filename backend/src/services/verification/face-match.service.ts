import path from 'path';
import sharp from 'sharp';

const MODEL_DIR = path.join(
  __dirname,
  '../../../node_modules/@vladmandic/face-api/model',
);

export type FaceMatchResult = {
  engineAvailable: boolean;
  idFaceFound: boolean;
  selfieFaceFound: boolean;
  distance: number | null;
  match: boolean;
  review: boolean;
};

type FaceApiModule = typeof import('@vladmandic/face-api');

let engineReady: Promise<FaceApiModule | null> | null = null;

function thresholds() {
  const pass = Number(process.env.VERIFICATION_FACE_PASS_THRESHOLD || '0.55');
  const reject = Number(process.env.VERIFICATION_FACE_REJECT_THRESHOLD || '0.65');
  return {
    pass: Number.isFinite(pass) ? pass : 0.55,
    reject: Number.isFinite(reject) ? reject : 0.65,
  };
}

function manualReviewFallback(): FaceMatchResult {
  return {
    engineAvailable: false,
    idFaceFound: false,
    selfieFaceFound: false,
    distance: null,
    match: false,
    review: true,
  };
}

async function loadEngine(): Promise<FaceApiModule | null> {
  if (!engineReady) {
    engineReady = (async () => {
      try {
        const [{ Canvas, Image, ImageData }, faceapi] = await Promise.all([
          import('@napi-rs/canvas'),
          import('@vladmandic/face-api'),
        ]);
        faceapi.env.monkeyPatch({
          Canvas: Canvas as any,
          Image: Image as any,
          ImageData: ImageData as any,
        });
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
        return faceapi;
      } catch (err) {
        console.warn(
          '[verify] face-match engine unavailable — submissions will queue for manual review:',
          err instanceof Error ? err.message : err,
        );
        return null;
      }
    })();
  }
  return engineReady;
}

async function loadFaceImage(ImageCtor: any, filePath: string): Promise<any> {
  const buffer = await sharp(filePath).rotate().jpeg({ quality: 92 }).toBuffer();
  const image = new ImageCtor();
  image.src = buffer;
  return image;
}

async function extractDescriptor(
  faceapi: FaceApiModule,
  ImageCtor: any,
  filePath: string,
): Promise<Float32Array | null> {
  const image = await loadFaceImage(ImageCtor, filePath);
  const detection = await faceapi
    .detectSingleFace(image)
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}

export const faceMatchService = {
  async detectFace(filePath: string): Promise<{ found: boolean; engineAvailable: boolean }> {
    let faceapi: FaceApiModule | null;
    try {
      faceapi = await loadEngine();
    } catch {
      return { found: false, engineAvailable: false };
    }

    if (!faceapi) {
      return { found: false, engineAvailable: false };
    }

    try {
      const { Image } = await import('@napi-rs/canvas');
      const descriptor = await extractDescriptor(faceapi, Image, filePath);
      return { found: Boolean(descriptor), engineAvailable: true };
    } catch (err) {
      console.warn(
        '[verify] face detect failed:',
        err instanceof Error ? err.message : err,
      );
      return { found: false, engineAvailable: false };
    }
  },

  async compare(idFrontPath: string, selfiePath: string): Promise<FaceMatchResult> {
    let faceapi: FaceApiModule | null;
    try {
      faceapi = await loadEngine();
    } catch {
      return manualReviewFallback();
    }

    if (!faceapi) {
      return manualReviewFallback();
    }

    try {
      const { Image } = await import('@napi-rs/canvas');
      const [idDescriptor, selfieDescriptor] = await Promise.all([
        extractDescriptor(faceapi, Image, idFrontPath),
        extractDescriptor(faceapi, Image, selfiePath),
      ]);

      if (!idDescriptor || !selfieDescriptor) {
        return {
          engineAvailable: true,
          idFaceFound: Boolean(idDescriptor),
          selfieFaceFound: Boolean(selfieDescriptor),
          distance: null,
          match: false,
          review: false,
        };
      }

      const distance = faceapi.euclideanDistance(idDescriptor, selfieDescriptor);
      const { pass, reject } = thresholds();

      return {
        engineAvailable: true,
        idFaceFound: true,
        selfieFaceFound: true,
        distance,
        match: distance < pass,
        review: distance >= pass && distance < reject,
      };
    } catch (err) {
      console.warn(
        '[verify] face-match compare failed — queuing manual review:',
        err instanceof Error ? err.message : err,
      );
      return manualReviewFallback();
    }
  },
};