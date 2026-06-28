import path from 'path';
import * as faceapi from '@vladmandic/face-api';
import { Canvas, Image, ImageData } from '@napi-rs/canvas';
import sharp from 'sharp';

faceapi.env.monkeyPatch({ Canvas: Canvas as any, Image: Image as any, ImageData: ImageData as any });

const MODEL_DIR = path.join(
  __dirname,
  '../../../node_modules/@vladmandic/face-api/model',
);

let modelsReady: Promise<void> | null = null;

function loadModels(): Promise<void> {
  if (!modelsReady) {
    modelsReady = (async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
    })();
  }
  return modelsReady;
}

async function loadFaceImage(filePath: string): Promise<any> {
  const buffer = await sharp(filePath).rotate().jpeg({ quality: 92 }).toBuffer();
  const image = new Image();
  image.src = buffer;
  return image;
}

async function extractDescriptor(filePath: string): Promise<Float32Array | null> {
  const image = await loadFaceImage(filePath);
  const detection = await faceapi
    .detectSingleFace(image)
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}

export type FaceMatchResult = {
  idFaceFound: boolean;
  selfieFaceFound: boolean;
  distance: number | null;
  match: boolean;
  review: boolean;
};

function thresholds() {
  const pass = Number(process.env.VERIFICATION_FACE_PASS_THRESHOLD || '0.55');
  const reject = Number(process.env.VERIFICATION_FACE_REJECT_THRESHOLD || '0.65');
  return {
    pass: Number.isFinite(pass) ? pass : 0.55,
    reject: Number.isFinite(reject) ? reject : 0.65,
  };
}

export const faceMatchService = {
  async compare(idFrontPath: string, selfiePath: string): Promise<FaceMatchResult> {
    await loadModels();

    const [idDescriptor, selfieDescriptor] = await Promise.all([
      extractDescriptor(idFrontPath),
      extractDescriptor(selfiePath),
    ]);

    if (!idDescriptor || !selfieDescriptor) {
      return {
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
      idFaceFound: true,
      selfieFaceFound: true,
      distance,
      match: distance < pass,
      review: distance >= pass && distance < reject,
    };
  },
};