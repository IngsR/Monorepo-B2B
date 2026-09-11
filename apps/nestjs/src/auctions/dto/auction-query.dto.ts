import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { AuctionStatus } from '../../database/prisma.types.js';

export const AUCTION_SORT_FIELDS = [
  'createdAt',
  'startAt',
  'endAt',
  'currentPrice',
] as const;

export type AuctionSortField = (typeof AUCTION_SORT_FIELDS)[number];

export class AuctionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsIn(Object.values(AuctionStatus))
  status?: AuctionStatus;

  @IsOptional()
  @IsIn(AUCTION_SORT_FIELDS)
  sortBy: AuctionSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
