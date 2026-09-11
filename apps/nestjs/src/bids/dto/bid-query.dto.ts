import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const BID_SORT_FIELDS = ['createdAt', 'amount'] as const;
export type BidSortField = (typeof BID_SORT_FIELDS)[number];

export class BidQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  auctionId?: string;

  @IsOptional()
  @IsUUID()
  bidderId?: string;

  @IsOptional()
  @IsIn(BID_SORT_FIELDS)
  sortBy: BidSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
