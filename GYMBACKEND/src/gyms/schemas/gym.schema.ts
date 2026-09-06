import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/** Where a gym's share of each payment is settled. */
@Schema({ _id: false })
export class SettlementAccount {
  @Prop({ required: true }) bankCode!: string;
  @Prop({ required: true }) bankName!: string;
  /** Stored in full for payouts; only the last four are ever returned. */
  @Prop({ required: true }) accountNumber!: string;
  @Prop({ required: true }) accountName!: string;
  /** Provider handles, set once the account is registered for payouts. */
  @Prop() recipientCode?: string;
  @Prop() subaccountCode?: string;
  @Prop() verifiedAt?: Date;
}

/** The gym's own subscription to the platform. */
@Schema({ _id: false })
export class Listing {
  @Prop({ required: true }) planId!: string;
  @Prop({ required: true }) planName!: string;
  @Prop({ required: true }) price!: number;
  @Prop({
    required: true,
    enum: ["unpaid", "active", "past_due"],
    default: "unpaid",
  })
  status!: "unpaid" | "active" | "past_due";
  @Prop() currentPeriodEnd?: Date;
  @Prop() lastReference?: string;
}

@Schema({ timestamps: true, collection: "gyms" })
export class Gym {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 60 })
  branch!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  area!: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ required: true, min: 500, max: 200000 })
  dayPassPrice!: number;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  ownerId!: Types.ObjectId;

  /**
   * `draft` until the listing payment clears — a draft gym is invisible in
   * search and cannot take member payments.
   */
  @Prop({
    required: true,
    enum: ["draft", "active", "suspended"],
    default: "draft",
    index: true,
  })
  status!: "draft" | "active" | "suspended";

  @Prop({ type: Listing })
  listing?: Listing;

  @Prop({ type: SettlementAccount })
  settlementAccount?: SettlementAccount;

  @Prop({ trim: true, maxlength: 240 })
  about?: string;
}

export type GymDocument = Gym & Document<Types.ObjectId>;
export const GymSchema = SchemaFactory.createForClass(Gym);

// Discover searches by name/area on active gyms only.
GymSchema.index({ status: 1, name: "text", area: "text" });
