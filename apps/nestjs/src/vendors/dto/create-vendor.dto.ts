import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateVendorDto {
  /** User (role VENDOR) yang menjadi pemilik profil vendor ini. */
  @IsUUID()
  userId: string;

  @IsString()
  @MaxLength(255)
  companyName: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  companyAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
