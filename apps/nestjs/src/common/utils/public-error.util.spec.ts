import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.js';
import { toPublicError } from './public-error.util.js';

describe('toPublicError', () => {
  it('returns a safe 500 payload for unknown errors', () => {
    const result = toPublicError(
      new Error('password=secret SELECT * FROM users'),
    );

    expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(result.body).toEqual({
      success: false,
      message: 'An unexpected error occurred',
      code: ErrorCode.INTERNAL_ERROR,
    });
  });

  it('keeps a public HttpException message and code', () => {
    const result = toPublicError(
      new HttpException(
        {
          success: false,
          message: 'Auction has already ended',
          code: 'AUCTION_ENDED',
        },
        HttpStatus.BAD_REQUEST,
      ),
    );

    expect(result.status).toBe(HttpStatus.BAD_REQUEST);
    expect(result.body).toEqual({
      success: false,
      message: 'Auction has already ended',
      code: 'AUCTION_ENDED',
    });
  });

  it('hides messages that look like secrets', () => {
    const result = toPublicError(
      new HttpException('JWT secret is abc123', HttpStatus.BAD_REQUEST),
    );

    expect(result.body.message).toBe('An unexpected error occurred');
  });

  it('maps a Prisma unique-constraint error (P2002) to 409 CONFLICT', () => {
    const result = toPublicError(
      Object.assign(new Error('Unique constraint failed'), {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
      }),
    );

    expect(result.status).toBe(HttpStatus.CONFLICT);
    expect(result.body).toEqual({
      success: false,
      message: 'Resource already exists or conflicts with existing data',
      code: ErrorCode.CONFLICT,
    });
  });

  it('maps a Prisma record-not-found error (P2025) to 404 NOT_FOUND', () => {
    const result = toPublicError(
      Object.assign(new Error('Record not found'), {
        name: 'PrismaClientKnownRequestError',
        code: 'P2025',
      }),
    );

    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.body).toEqual({
      success: false,
      message: 'Resource not found',
      code: 'HTTP_ERROR',
    });
  });

  it('does not leak Prisma internals for an unmapped Prisma code', () => {
    const result = toPublicError(
      Object.assign(new Error('Raw query failed. Code: 12P01'), {
        name: 'PrismaClientKnownRequestError',
        code: 'P9999',
      }),
    );

    expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(result.body.message).toBe('An unexpected error occurred');
  });

  it('maps 403 to FORBIDDEN and 401 to UNAUTHORIZED codes', () => {
    expect(toPublicError(new HttpException('nope', 403)).body.code).toBe(
      ErrorCode.FORBIDDEN,
    );
    expect(toPublicError(new HttpException('nope', 401)).body.code).toBe(
      ErrorCode.UNAUTHORIZED,
    );
  });
});
