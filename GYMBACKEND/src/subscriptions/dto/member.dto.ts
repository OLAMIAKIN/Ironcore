import { Transform } from "class-transformer";
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { normalisePhone } from "@/common/utils/phone";

/**
 * Adding a member the gym already has — a migration from a paper register, or
 * someone signed up at the desk. No money changes hands, so this never touches
 * the ledger and is limited to owners and managers.
 */
export class AddMemberDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? normalisePhone(value) : value,
  )
  @Matches(/^0[789][01]\d{8}$/, { message: "Enter a valid phone number" })
  phone!: string;

  @IsMongoId()
  planId!: string;

  /** Days of cover to grant. Defaults to the plan's own length. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1095)
  daysLeft?: number;
}
