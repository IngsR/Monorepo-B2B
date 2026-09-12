import { describe, expect, it } from 'vitest';
import { failureHeadline, toApiFailure } from './api-failure';
import {
  formatAmount,
  formatCountdown,
  formatDuration,
  formatRelative,
  parseAmount,
} from './format';

describe('toApiFailure', () => {
  /** Builds the kind of error an Angular HttpClient surfaces. */
  const httpError = (status: number, body: unknown) => ({ status, error: body });

  it('uses a safe default message for a 403 rather than the backend text', () => {
    const failure = toApiFailure(httpError(403, { message: 'FORBIDDEN' }));
    expect(failure.status).toBe(403);
    expect(failure.code).toBe('FORBIDDEN');
    expect(failure.message).toMatch(/do not have access/i);
  });

  it('never surfaces Prisma, SQL or stack-trace detail', () => {
    const failure = toApiFailure(
      httpError(500, {
        message:
          'PrismaClientKnownRequestError: Invalid `prisma.user.findMany()` invocation\n    at Nn (/app/node_modules/@prisma/client/runtime.js:1234:56)',
      }),
    );
    expect(failure.message).not.toMatch(/prisma/i);
    expect(failure.message).not.toMatch(/node_modules/);
    expect(failure.message).not.toMatch(/at Nn/);
    expect(failure.message).toMatch(/went wrong/i);
  });

  it('does not leak database connectivity detail on a 503', () => {
    const failure = toApiFailure(
      httpError(503, { code: 'DATABASE_UNAVAILABLE', message: 'ECONNREFUSED 127.0.0.1:5432' }),
    );
    expect(failure.message).not.toMatch(/ECONNREFUSED/);
    expect(failure.message).not.toMatch(/5432/);
    expect(failure.message).toMatch(/temporarily unavailable/i);
  });

  it('keeps a short, human-readable server message', () => {
    const failure = toApiFailure(
      httpError(409, {
        code: 'CONFLICT',
        message: 'Your bid is below the minimum next bid of 121,000.',
      }),
    );
    expect(failure.message).toContain('below the minimum next bid');
  });

  it('maps a conflict to a retryable explanation', () => {
    const failure = toApiFailure(httpError(409, { code: 'CONFLICT', message: 'Conflict' }));
    expect(failure.status).toBe(409);
    expect(failure.message).toMatch(/conflicts with the current state/i);
  });

  it('carries field errors through for form binding', () => {
    const failure = toApiFailure(
      httpError(400, {
        code: 'VALIDATION_ERROR',
        message: 'Please check the highlighted fields.',
        fieldErrors: { email: 'This email address is already registered' },
      }),
    );
    expect(failure.fieldErrors?.['email']).toContain('already registered');
  });

  it('treats a missing status as a network failure', () => {
    const failure = toApiFailure({ message: 'Http failure response' });
    expect(failure.status).toBe(0);
    expect(failure.message).toMatch(/cannot reach the server/i);
  });

  it('falls back to a generic message for an unknown code', () => {
    const failure = toApiFailure(httpError(418, { code: 'TEAPOT', message: 'nope' }));
    expect(failure.code).toBe('TEAPOT');
    expect(failure.message.length).toBeGreaterThan(0);
  });
});

describe('failureHeadline', () => {
  it('gives access problems their own copy', () => {
    expect(failureHeadline(toApiFailure({ status: 403, error: {} })).title).toMatch(
      /access denied/i,
    );
    expect(failureHeadline(toApiFailure({ status: 401, error: {} })).title).toMatch(
      /sign-in required/i,
    );
    expect(failureHeadline(toApiFailure({ status: 404, error: {} })).title).toMatch(/not found/i);
  });
});

describe('currency formatting', () => {
  it('formats with two decimals and thousands separators', () => {
    expect(formatAmount(1250)).toBe('1,250.00');
    expect(formatAmount(118500)).toBe('118,500.00');
    expect(formatAmount(0)).toBe('0.00');
  });

  it('renders a placeholder for a missing value rather than NaN or undefined', () => {
    expect(formatAmount(null)).toBe('—');
    expect(formatAmount(undefined)).toBe('—');
    expect(formatAmount(Number.NaN)).toBe('—');
  });
});

describe('duration and countdown formatting', () => {
  const MIN = 60_000;
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  it('formats a coarse duration', () => {
    expect(formatDuration(42 * MIN)).toBe('42m 00s');
    expect(formatDuration(5 * HOUR + 12 * MIN)).toBe('05h 12m');
    expect(formatDuration(2 * DAY + 4 * HOUR)).toBe('2d 04h');
  });

  it('formats a precise countdown', () => {
    expect(formatCountdown(42 * MIN)).toBe('42:00');
    expect(formatCountdown(5 * HOUR + 12 * MIN + 30_000)).toBe('05:12:30');
    expect(formatCountdown(2 * DAY + 4 * HOUR)).toBe('2d 04:00:00');
  });

  it('renders a closed countdown as zero rather than a negative', () => {
    expect(formatCountdown(-5000)).toBe('00:00');
    expect(formatDuration(-5000)).toBe('—');
  });
});

describe('formatRelative', () => {
  const NOW = Date.parse('2026-01-15T12:00:00Z');
  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  it('describes recent activity', () => {
    expect(formatRelative(ago(10_000), NOW)).toBe('just now');
    expect(formatRelative(ago(12 * 60_000), NOW)).toBe('12m ago');
    expect(formatRelative(ago(3 * 3_600_000), NOW)).toBe('3h ago');
    expect(formatRelative(ago(2 * 86_400_000), NOW)).toBe('2d ago');
  });
});

describe('parseAmount', () => {
  it('accepts digits, separators and a currency symbol', () => {
    expect(parseAmount('1,250.00')).toBe(1250);
    expect(parseAmount('$1,250.00')).toBe(1250);
    expect(parseAmount(' 121000 ')).toBe(121000);
    expect(parseAmount(121000)).toBe(121000);
  });

  it('rejects empty and non-numeric input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-')).toBeNull();
  });
});
