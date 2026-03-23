import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db';
import { RegisterInput, LoginInput } from '../types/validation';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

type TokenPayload = {
  userId: string;
  exp: number;
};

const base64UrlEncode = (input: Buffer | string): string => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const base64UrlDecode = (input: string): Buffer => {
  const padLength = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
};

const signToken = (userId: string): string => {
  const payload: TokenPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadPart = base64UrlEncode(payloadJson);
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadJson)
    .digest();
  const signaturePart = base64UrlEncode(signature);
  return `${payloadPart}.${signaturePart}`;
};

const verifyTokenInternal = (token: string): TokenPayload => {
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) {
    throw new Error('Invalid token');
  }

  const payloadJson = base64UrlDecode(payloadPart).toString('utf8');
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadJson)
    .digest();
  const actualSignature = base64UrlDecode(signaturePart);

  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error('Invalid token');
  }

  const payload = JSON.parse(payloadJson) as TokenPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
};

export const authService = {
  async register(data: RegisterInput) {
    const id = uuidv4();
    const hashedPassword = await bcryptjs.hash(data.password, 10);

    try {
      const result = await query(
        `INSERT INTO users (id, email, password_hash, name, age) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, email, name, age`,
        [id, data.email, hashedPassword, data.name, data.age]
      );

      const user = result.rows[0];
      const token = signToken(user.id);

      return { user, token };
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error('Email already exists');
      }
      throw error;
    }
  },

  async login(data: LoginInput) {
    const result = await query(
      `SELECT id, email, password_hash, name FROM users WHERE email = $1`,
      [data.email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];
    const validPassword = await bcryptjs.compare(data.password, user.password_hash);

    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    const token = signToken(user.id);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      token,
    };
  },

  verifyToken(token: string) {
    const payload = verifyTokenInternal(token);
    return { userId: payload.userId };
  },
};
