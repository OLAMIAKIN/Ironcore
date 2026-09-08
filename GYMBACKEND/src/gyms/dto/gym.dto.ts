import { Type } from "class-transformer";
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PaginationQuery } from "@/common/dto/pagination.dto";

/**
 * Discover, optionally anchored to where the member is standing. Both
 * coordinates or neither — a latitude on its own cannot locate anything.
 */
export class FindGymsQuery extends PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  /** How far out to look, in kilometres. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  radiusKm?: number;
}

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
  @Min(100)
  @Max(200000)
  dayPassPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  about?: string;

  /** Where the gym is. Sent together or not at all. */
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;
}

/** Turning something typed in a box into a place on the map. */
export class GeocodeQuery {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  q!: string;
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
