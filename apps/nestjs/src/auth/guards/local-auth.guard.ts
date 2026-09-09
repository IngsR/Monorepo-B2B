import {
  BadRequestException,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  constructor() {
    super();
  }

  handleRequest(err: unknown, user: any, info: any, context: ExecutionContext, status?: any) {
    if (status === 400 || info?.message === 'Missing credentials') {
      throw new BadRequestException(info?.message ?? 'Missing credentials');
    }
    if (err || !user) {
      throw (err as Error) || new UnauthorizedException();
    }
    return user;
  }
}
