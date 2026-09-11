import { IsString, Matches, Validate } from 'class-validator';
import {
  DECIMAL_PATTERN,
  IsPositiveDecimalConstraint,
} from '../../auctions/dto/decimal.validators.js';

export class CreateBidDto {
  /** Jumlah penawaran sebagai string desimal (presisi 2 angka di belakang koma). */
  @IsString()
  @Matches(DECIMAL_PATTERN, {
    message: 'amount must be a decimal with up to 2 fractional digits',
  })
  @Validate(IsPositiveDecimalConstraint)
  amount: string;
}
