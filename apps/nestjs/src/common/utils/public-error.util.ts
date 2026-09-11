import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.js';

const SECRET_PATTERN =
  /(password|secret|token|authorization|jwt|pg_|sql|query)/i;

/**
 * Deteksi Prisma `PrismaClientKnownRequestError` secara struktural
 * (duck-typing) agar tidak bergantung pada path internal runtime Prisma yang
 * bisa berubah antar versi. Error ini tidak boleh bocor mentah ke API — kita
 * petakan ke HTTP status yang bermakna.
 */
const PRISMA_ERROR_NAME = 'PrismaClientKnownRequestError';

/** Kode Prisma yang dipetakan ke HTTP status. Lihat Prisma error reference. */
const PRISMA_CODE_TO_STATUS: Record<string, number> = {
  P2002: HttpStatus.CONFLICT, // unique constraint violation
  P2003: HttpStatus.CONFLICT, // foreign key constraint violation
  P2025: HttpStatus.NOT_FOUND, // record not found (update/delete)
};

export type PublicErrorBody = {
  success: false;
  message: string;
  code: string;
};

export function toPublicError(exception: unknown): {
  status: number;
  body: PublicErrorBody;
} {
  if (exception instanceof HttpException) {
    return fromHttpException(exception);
  }

  const prismaStatus = prismaErrorStatus(exception);

  if (prismaStatus !== undefined) {
    return {
      status: prismaStatus,
      body: {
        success: false,
        message: defaultMessageForStatus(prismaStatus),
        code: statusCodeToErrorCode(prismaStatus),
      },
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      success: false,
      message: 'An unexpected error occurred',
      code: ErrorCode.INTERNAL_ERROR,
    },
  };
}

/** Kembalikan HTTP status untuk Prisma known error, atau undefined. */
function prismaErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }

  const candidate = exception as { name?: unknown; code?: unknown };

  if (
    candidate.name !== PRISMA_ERROR_NAME ||
    typeof candidate.code !== 'string'
  ) {
    return undefined;
  }

  return PRISMA_CODE_TO_STATUS[candidate.code];
}

function defaultMessageForStatus(status: number): string {
  if (status === HttpStatus.NOT_FOUND) {
    return 'Resource not found';
  }

  if (status === HttpStatus.CONFLICT) {
    return 'Resource already exists or conflicts with existing data';
  }

  return 'An unexpected error occurred';
}

function fromHttpException(exception: HttpException): {
  status: number;
  body: PublicErrorBody;
} {
  const status = exception.getStatus();
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return {
      status,
      body: {
        success: false,
        message: sanitizeMessage(response),
        code: statusCodeToErrorCode(status),
      },
    };
  }

  const payload = response as Record<string, unknown>;
  const message = firstMessage(payload.message) ?? 'Request failed';
  const code =
    typeof payload.code === 'string'
      ? payload.code
      : statusCodeToErrorCode(status);

  return {
    status,
    body: {
      success: false,
      message: sanitizeMessage(message),
      code,
    },
  };
}

function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
}

function statusCodeToErrorCode(status: number): string {
  if (status === HttpStatus.BAD_REQUEST) {
    return ErrorCode.VALIDATION_ERROR;
  }

  if (status === HttpStatus.UNAUTHORIZED) {
    return ErrorCode.UNAUTHORIZED;
  }

  if (status === HttpStatus.FORBIDDEN) {
    return ErrorCode.FORBIDDEN;
  }

  if (status === HttpStatus.CONFLICT) {
    return ErrorCode.CONFLICT;
  }

  if (status >= 500) {
    return ErrorCode.INTERNAL_ERROR;
  }

  return 'HTTP_ERROR';
}

function sanitizeMessage(message: string): string {
  if (SECRET_PATTERN.test(message)) {
    return 'An unexpected error occurred';
  }

  return message;
}
