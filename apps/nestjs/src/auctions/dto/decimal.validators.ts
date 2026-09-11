import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Decimal sebagai string dengan maksimal 2 desimal (mis. "100000.00"). */
export const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Nilai moneternya harus > 0. */
@ValidatorConstraint({ name: 'isPositiveDecimal', async: false })
export class IsPositiveDecimalConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
      return false;
    }
    return Number(value) > 0;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a positive decimal with up to 2 fractional digits`;
  }
}
