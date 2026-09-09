import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.js';

const SECRET_PATTERN =
  /(password|secret|token|authorization|jwt|pg_|sql|query)/i;

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

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      success: false,
      message: 'An unexpected error occurred',
      code: ErrorCode.INTERNAL_ERROR,
    },
  };
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
