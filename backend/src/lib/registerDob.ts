import { ageFromDateOfBirth, parseIsoDateOnly } from './age';

/**
 * Register needs a full, real date of birth (YYYY-MM-DD). A bare age is refused.
 * Under 18 is refused before any account row is created.
 */
export type RegisterDobError = {
  code: 'date_of_birth_required' | 'date_of_birth_invalid' | 'under_18';
  message: string;
};

export const REGISTER_DOB_MESSAGES: Record<RegisterDobError['code'], string> = {
  date_of_birth_required: 'Please enter your full date of birth.',
  date_of_birth_invalid: 'Please enter a real date of birth, with the day, month and year.',
  under_18: 'You must be 18 or older to join MenRush.',
};

export function registerDobError(value: unknown, asOf: Date = new Date()): RegisterDobError | null {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return { code: 'date_of_birth_required', message: REGISTER_DOB_MESSAGES.date_of_birth_required };
  }
  if (typeof value !== 'string') {
    return { code: 'date_of_birth_invalid', message: REGISTER_DOB_MESSAGES.date_of_birth_invalid };
  }
  let age: number;
  try {
    const birth = parseIsoDateOnly(value);
    if (birth.getTime() > asOf.getTime()) throw new Error('future');
    age = ageFromDateOfBirth(value, asOf);
  } catch {
    return { code: 'date_of_birth_invalid', message: REGISTER_DOB_MESSAGES.date_of_birth_invalid };
  }
  if (age > 120) {
    return { code: 'date_of_birth_invalid', message: REGISTER_DOB_MESSAGES.date_of_birth_invalid };
  }
  if (age < 18) {
    return { code: 'under_18', message: REGISTER_DOB_MESSAGES.under_18 };
  }
  return null;
}

/** Thrown by authService.register so the route can answer 400 with the friendly code. */
export class RegisterDobRefusedError extends Error {
  readonly code: RegisterDobError['code'];
  constructor(err: RegisterDobError) {
    super(err.message);
    this.name = 'RegisterDobRefusedError';
    this.code = err.code;
  }
}
