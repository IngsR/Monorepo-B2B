import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.js';

export class AppException extends HttpException {
  readonly code: string;

  constructor(
    message: string,
    code: string = ErrorCode.INTERNAL_ERROR,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ success: false, message, code }, status);
    this.code = code;
  }
}
