import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { normalisePhone } from "@/common/utils/phone";

/** "0803 214 7765" and "+2348032147765" both land on the same stored value. */
const Phone = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? normalisePhone(value) : value,
  );

class PhoneAndPassword {
  @Phone()
  @IsString()
  @Matches(/^0[789][01]\d{8}$/, {
    message: "Enter a valid Nigerian phone number",
  })
  phone!: string;

  @IsString()
  @MinLength(8, { message: "Use at least 8 characters" })
  @MaxLength(128)
  password!: string;
}

export class LoginDto extends PhoneAndPassword {}

export class RegisterMemberDto extends PhoneAndPassword {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;
}

/**
 * Onboarding step one. The gym is created in `draft` — invisible in search and
 * unable to take member payments until the listing payment clears.
 */
export class RegisterGymDto extends PhoneAndPassword {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ownerName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  gymName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  branch!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  area!: string;

  // Floor is deliberately low so a gym can price a demo or a promo run at a
  // token amount; the ceiling is what stops a typo becoming a real charge.
  @IsInt()
  @Min(100)
  @Max(200000)
  dayPassPrice!: number;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
