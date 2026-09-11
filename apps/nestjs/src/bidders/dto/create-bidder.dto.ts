import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBidderDto {
  /** User (role BIDDER) yang menjadi pemilik profil bidder ini. */
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;
}
