import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route yang di-mark @Public() tidak memerlukan JWT token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
