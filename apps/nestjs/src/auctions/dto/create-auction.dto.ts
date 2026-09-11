import {
  IsDateString,
  IsUUID,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  DECIMAL_PATTERN,
  IsPositiveDecimalConstraint,
} from './decimal.validators.js';

/** startAt harus sebelum endAt. */
@ValidatorConstraint({ name: 'isBeforeEndAt', async: false })
class IsBeforeEndAt implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const endAt = (args.object as CreateAuctionDto).endAt;
    if (!value || !endAt) return true; // divalidasi terpisah
    return new Date(value as string).getTime() < new Date(endAt).getTime();
  }

  defaultMessage(): string {
    return 'startAt must be before endAt';
  }
}

export class CreateAuctionDto {
  @IsUUID()
  productId: string;

  @Matches(DECIMAL_PATTERN, {
    message: 'startingPrice must be a decimal with up to 2 fractional digits',
  })
  @Validate(IsPositiveDecimalConstraint)
  startingPrice: string;

  @Matches(DECIMAL_PATTERN, {
    message: 'bidIncrement must be a decimal with up to 2 fractional digits',
  })
  @Validate(IsPositiveDecimalConstraint)
  bidIncrement: string;

  @IsDateString()
  @Validate(IsBeforeEndAt)
  startAt: string;

  @IsDateString()
  endAt: string;
}
