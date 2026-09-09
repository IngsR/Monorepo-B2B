import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class PlaceBidDto {
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  amount: number;
}
