import { ApiErrorCode } from './enums';

/**
 * Normalised, presentation-ready view of an API failure.
 *
 * The backend may return a technical message; the UI must never surface raw
 * Prisma/SQL errors, stack traces or database details. `ApiFailure` carries a
 * safe, human-readable message plus the fields needed to render a sensible
 * recovery action.
 */
export interface ApiFailure {
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
  /** Machine-readable code from the response envelope. */
  code: string;
  /** Safe headline for the user. */
  message: string;
  /** Optional supporting sentence explaining what to do next. */
  detail?: string;
  /** Field-level validation messages keyed by form control name. */
  fieldErrors?: Record<string, string>;
  /** Milliseconds to wait before retrying, when the server asks for a back-off. */
  retryAfterMs?: number;
}

const DEFAULT_MESSAGES: Record<string, Pick<ApiFailure, 'message' | 'detail'>> = {
  [ApiErrorCode.VALIDATION_ERROR]: {
    message: 'Please check the highlighted fields',
    detail: 'Some values were rejected by the server. Correct them and submit again.',
  },
  [ApiErrorCode.UNAUTHORIZED]: {
    message: 'Your session has expired',
    detail: 'Sign in again to continue where you left off.',
  },
  [ApiErrorCode.FORBIDDEN]: {
    message: 'You do not have access to this action',
    detail: 'This resource belongs to another account, or your role is not permitted to change it.',
  },
  [ApiErrorCode.NOT_FOUND]: {
    message: 'We could not find that record',
    detail: 'It may have been deleted, or the link may be out of date.',
  },
  [ApiErrorCode.CONFLICT]: {
    message: 'This action conflicts with the current state',
    detail: 'The record changed since this page was loaded. Reload to see the latest data.',
  },
  [ApiErrorCode.DATABASE_UNAVAILABLE]: {
    message: 'The platform is temporarily unavailable',
    detail: 'We could not reach the data store. Please try again in a moment.',
  },
  [ApiErrorCode.INTERNAL_ERROR]: {
    message: 'Something went wrong on our side',
    detail: 'The request could not be completed. Please try again.',
  },
};

const STATUS_TO_CODE: Record<number, string> = {
  0: 'NETWORK_ERROR',
  400: ApiErrorCode.VALIDATION_ERROR,
  401: ApiErrorCode.UNAUTHORIZED,
  403: ApiErrorCode.FORBIDDEN,
  404: ApiErrorCode.NOT_FOUND,
  409: ApiErrorCode.CONFLICT,
  500: ApiErrorCode.INTERNAL_ERROR,
  503: ApiErrorCode.DATABASE_UNAVAILABLE,
};

/**
 * True when a server-supplied message should NOT be shown to the user.
 *
 * Two cases are rejected:
 *  1. It exposes backend internals — Prisma, SQL, driver errors, stack frames.
 *  2. It is not really a sentence. Backends commonly send the machine code
 *     itself (`"FORBIDDEN"`, `"CONFLICT"`) or an `UPPER_SNAKE` enum name, which
 *     is meaningless to a user. In that case the curated default is better.
 */
function looksTechnical(message: string): boolean {
  const internals =
    /prisma|sql|postgres|pg_|knex|typeorm|sequelize/i.test(message) ||
    /at\s+\w+\s+\(.*:\d+:\d+\)/.test(message) ||
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|duplicate key value/i.test(message) ||
    /\bstack\b/i.test(message);

  // A single word, all-uppercase, or an enum-style token is not human copy.
  const isBareCode = !/\s/.test(message.trim()) || /^[A-Z][A-Z0-9_]*$/.test(message.trim());

  return internals || isBareCode;
}

/** Maps any thrown HTTP error into a safe, displayable failure. */
export function toApiFailure(error: unknown): ApiFailure {
  const err = error as {
    status?: number;
    error?: { message?: string; code?: string; fieldErrors?: Record<string, string> };
    message?: string;
  } | null;

  const status = typeof err?.status === 'number' ? err.status : 0;
  const body = err?.error;
  const code = body?.code || STATUS_TO_CODE[status] || 'UNKNOWN_ERROR';
  const fallback = DEFAULT_MESSAGES[code] ?? {
    message: 'The request could not be completed',
    detail: 'Please try again. If the problem continues, contact your administrator.',
  };

  const rawMessage = typeof body?.message === 'string' ? body.message : '';
  const useServerMessage =
    rawMessage.length > 0 && rawMessage.length < 200 && !looksTechnical(rawMessage);

  if (status === 0) {
    return {
      status,
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the server',
      detail: 'Check your network connection, then try again.',
    };
  }

  return {
    status,
    code,
    message: useServerMessage ? rawMessage : fallback.message,
    detail: fallback.detail,
    fieldErrors: body?.fieldErrors,
  };
}

/** Convenience predicates used by guards and detail screens. */
export const isUnauthorized = (f: ApiFailure) => f.status === 401;
export const isForbidden = (f: ApiFailure) => f.status === 403;
export const isNotFound = (f: ApiFailure) => f.status === 404;
export const isConflict = (f: ApiFailure) => f.status === 409;
export const isValidation = (f: ApiFailure) => f.status === 400;

/** Page-level headline/description for a failed resource load. */
export function failureHeadline(failure: ApiFailure): { title: string; description: string } {
  switch (failure.status) {
    case 401:
      return {
        title: 'Sign-in required',
        description: 'Your session has expired. Sign in again to view this page.',
      };
    case 403:
      return {
        title: 'Access denied',
        description: 'This resource does not belong to your account, or your role cannot view it.',
      };
    case 404:
      return {
        title: 'Not found',
        description: 'This record no longer exists or the link is incorrect.',
      };
    case 503:
    case 500:
      return {
        title: 'Temporarily unavailable',
        description: 'The platform could not complete the request. Try again in a moment.',
      };
    default:
      return { title: failure.message, description: failure.detail ?? 'Please try again.' };
  }
}
