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
        // The default Node entrypoint hard-depends on tfjs-node's large native
        // binary. The WASM build is portable across local macOS and production
        // Linux while providing the same descriptor and distance APIs.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const faceapi = require(
          '@vladmandic/face-api/dist/face-api.node-wasm.js'
        ) as FaceApiModule;
        await (faceapi as any).tf.ready();
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

async function extractDescriptor(
  faceapi: FaceApiModule,
  filePath: string,
): Promise<Float32Array | null> {
  const { data, info } = await sharp(filePath)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tensor = (faceapi as any).tf.tensor3d(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    [info.height, info.width, info.channels],
    'int32',
  );
  try {
    const detection = await faceapi
      .detectSingleFace(
        tensor as any,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2, maxResults: 1 }),
      )
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection?.descriptor ?? null;
  } finally {
    tensor.dispose();
  }
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
      const descriptor = await extractDescriptor(faceapi, filePath);
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
      const [idDescriptor, selfieDescriptor] = await Promise.all([
        extractDescriptor(faceapi, idFrontPath),
        extractDescriptor(faceapi, selfiePath),
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
