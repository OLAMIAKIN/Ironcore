import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from "class-validator";

export class InitializePaymentDto {
  @IsEnum(["subscription", "day_pass", "listing"])
  purpose!: "subscription" | "day_pass" | "listing";

  @IsEnum(["card", "opay", "transfer"])
  channel!: "card" | "opay" | "transfer";

  /** Required for subscription and day pass; ignored for listing. */
  @IsOptional()
  @IsMongoId()
  gymId?: string;

  /** The gym's membership plan being bought. */
  @IsOptional()
  @IsMongoId()
  planId?: string;

  /** The platform listing tier, for a gym going live. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  listingPlanId?: string;

  /** Whose name goes on a guest pass, when it is not the payer's own. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  guestName?: string;
}

/**
 * Sandbox only. The real gateway decides the outcome itself; this exists so the
 * whole flow, including the decline path, can be walked without a card.
 */
export class SimulatePaymentDto {
  @IsEnum(["success", "failed"])
  outcome!: "success" | "failed";
}
