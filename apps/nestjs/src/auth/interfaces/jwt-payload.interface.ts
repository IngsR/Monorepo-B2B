import { UserRole } from '../../common/enums/user-role.enum.js';

/**
 * Payload yang disimpan di JWT dan dikembalikan dari JwtStrategy.validate().
 *
 * Ini adalah definisi canonical untuk bentuk payload JWT (mekanisme auth),
 * sehingga tinggal di `auth/interfaces/`. Konsumen di seluruh fitur
 * mengimpornya dari sini.
 */
export interface JwtPayload {
  sub: string;
  userId: string;
  email: string;
  role: UserRole;
}
