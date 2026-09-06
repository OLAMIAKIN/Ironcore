import {
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateGymDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  branch?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  area?: string;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(200000)
  dayPassPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  about?: string;
}

export class ResolveAccountDto {
  @IsString()
  @Length(3, 10)
  bankCode!: string;

  /** NUBAN numbers are ten digits; anything else is a typo. */
  @IsNumberString()
  @Length(10, 10)
  accountNumber!: string;
}

export class SetSettlementAccountDto extends ResolveAccountDto {}
