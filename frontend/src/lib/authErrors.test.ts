import { describe, expect, it } from 'vitest';
import {
  extractApiErrorMessage,
  loginErrorMessage,
  registerErrorMessage,
} from './authErrors';

describe('authErrors', () => {
  describe('extractApiErrorMessage', () => {
    it('extracts string error from response.data.error', () => {
      const err = {
        response: {
          status: 400,
          data: { error: 'Email already exists' },
        },
      };
      expect(extractApiErrorMessage(err)).toBe('Email already exists');
    });

    it('returns null when response is missing or error is not string', () => {
      expect(extractApiErrorMessage(new Error('Network error'))).toBeNull();
      expect(extractApiErrorMessage(null)).toBeNull();
      expect(extractApiErrorMessage({ response: { data: {} } })).toBeNull();
    });
  });

  describe('registerErrorMessage', () => {
    it('prioritizes response.data.error over generic Axios err.message (400 duplicate email)', () => {
      const axiosErr = {
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: { error: 'Email already exists' },
        },
      };

      const result = registerErrorMessage(axiosErr);
      expect(result.message).toBe(
        'An account with this email already exists. Sign in or reset your password.',
      );
      expect(result.isDuplicateEmail).toBe(true);
      expect(result.message).not.toContain('status code 400');
    });

    it('extracts non-duplicate API errors verbatim', () => {
      const axiosErr = {
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: { error: 'You must be 18 or older to join MenRush.' },
        },
      };

      const result = registerErrorMessage(axiosErr);
      expect(result.message).toBe('You must be 18 or older to join MenRush.');
      expect(result.isDuplicateEmail).toBeUndefined();
    });

    it('falls back to non-generic error message when no response data exists', () => {
      const networkErr = new Error('Network connection failed');
      const result = registerErrorMessage(networkErr);
      expect(result.message).toBe('Network connection failed');
      expect(result.isDuplicateEmail).toBeUndefined();
    });

    it('falls back to default registration error when message is generic Axios code status', () => {
      const genericAxios = new Error('Request failed with status code 400');
      const result = registerErrorMessage(genericAxios);
      expect(result.message).toBe('Registration failed. Please try again.');
    });
  });

  describe('loginErrorMessage', () => {
    it('formats invalid credentials', () => {
      const err = { response: { data: { error: 'Invalid credentials' } } };
      expect(loginErrorMessage(err)).toBe(
        'Email or password is incorrect. Check both, or use Forgot password.',
      );
    });

    it('handles service unavailable statuses', () => {
      expect(loginErrorMessage({ response: { status: 404 } })).toBe(
        'Sign-in service is temporarily unavailable. Try again in a moment.',
      );
      expect(loginErrorMessage({ response: { status: 405 } })).toBe(
        'Sign-in service is temporarily unavailable. Try again in a moment.',
      );
    });
  });
});
