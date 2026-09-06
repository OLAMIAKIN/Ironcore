import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name!: string;

  @IsInt()
  @Min(500)
  @Max(10_000_000)
  price!: number;

  @IsInt()
  @Min(1)
  @Max(1095)
  durationDays!: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  perks?: string;

  @IsOptional()
  @IsBoolean()
  popular?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(10_000_000)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1095)
  durationDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  perks?: string;

  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
