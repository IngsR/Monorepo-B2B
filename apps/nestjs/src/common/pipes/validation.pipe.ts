import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.js';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const first = errors[0];
      const message =
        first && first.constraints
          ? Object.values(first.constraints)[0]
          : 'Validation failed';

      return new BadRequestException({
        success: false,
        message,
        code: ErrorCode.VALIDATION_ERROR,
      });
    },
  });
}
