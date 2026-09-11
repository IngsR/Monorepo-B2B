import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBidderDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string | null;
}
