import { UserRole } from '../../common/enums/user-role.enum.js';

/** Payload yang disimpan di JWT dan dikembalikan dari JwtStrategy.validate(). */
export interface JwtPayload {
  sub: string;
  userId: string;
  email: string;
  role: UserRole;
}
