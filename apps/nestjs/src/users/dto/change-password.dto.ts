import { IsString, MaxLength, MinLength } from 'class-validator';

/** Mengubah password milik user yang sedang login. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword: string;
}
