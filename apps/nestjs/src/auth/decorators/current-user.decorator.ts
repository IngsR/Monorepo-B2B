import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

/** Extract user dari JWT payload yang sudah divalidasi. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    return request.user;
  },
);
