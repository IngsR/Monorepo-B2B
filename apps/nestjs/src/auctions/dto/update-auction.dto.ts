import { Matches, IsOptional, Validate } from 'class-validator';
import {
  IsPositiveDecimalConstraint,
  DECIMAL_PATTERN,
} from './decimal.validators.js';

export class UpdateAuctionDto {
  @IsOptional()
  @Matches(DECIMAL_PATTERN, {
    message: 'startingPrice must be a decimal with up to 2 fractional digits',
  })
  @Validate(IsPositiveDecimalConstraint)
  startingPrice?: string;

  @IsOptional()
  @Matches(DECIMAL_PATTERN, {
    message: 'bidIncrement must be a decimal with up to 2 fractional digits',
  })
  @Validate(IsPositiveDecimalConstraint)
  bidIncrement?: string;
}
