import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  companyAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;
}
