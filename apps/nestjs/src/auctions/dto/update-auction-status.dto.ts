import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuctionStatus } from '../enums/auction-status.enum.js';

export class UpdateAuctionStatusDto {
  @IsEnum(AuctionStatus)
  status: AuctionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
