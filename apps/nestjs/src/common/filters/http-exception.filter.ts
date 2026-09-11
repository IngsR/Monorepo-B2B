import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { toPublicError } from '../utils/public-error.util.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const { status, body } = toPublicError(exception);

    if (!(exception instanceof HttpException)) {
      // Server-side logging only — never sent to the client. Preserve the
      // original error/stack so Prisma and infrastructure failures stay
      // debuggable while the response body stays generic.
      const detail =
        exception instanceof Error ? exception.stack ?? exception.message : String(exception);
      this.logger.error(`Unhandled exception: ${detail}`);
    }

    response.status(status).json(body);
  }
}
