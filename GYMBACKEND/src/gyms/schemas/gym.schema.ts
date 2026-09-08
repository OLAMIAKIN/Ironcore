import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * A GeoJSON point, as Mongo wants it: `[longitude, latitude]`, which is the
 * reverse of how everyone says it aloud.
 *
 * `default: undefined` on the field that uses this matters more than it looks.
 * Give the inner `type` a default instead and Mongoose helpfully materialises
 * `{ type: "Point" }` with no coordinates on every new gym — which a 2dsphere
 * index refuses ("Can't extract geo keys"), taking the whole insert down with
 * it. The subdocument has to be absent until someone actually places the pin.
 */
@Schema({ _id: false })
export class GeoPoint {
  @Prop({ required: true, enum: ["Point"], default: "Point" })
  type!: "Point";

  @Prop({ required: true, type: [Number] })
  coordinates!: [number, number];
}

const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

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
  /**
   * Which gateway issued the handles above. A subaccount created by the mock
   * gateway means nothing to Paystack, and sending one to the real API fails
   * the whole payment with "Invalid Subaccount" — so the issuer is recorded and
   * checked before the code is ever used.
   */
  @Prop() provider?: string;
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

  // Matches the DTO's floor. Mongoose validates on save too, so leaving this
  // at the old minimum would reject a price the API had just accepted.
  @Prop({ required: true, min: 100, max: 200000 })
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

  /**
   * Where the gym actually is, as GeoJSON — `[longitude, latitude]`, which is
   * the order Mongo wants and the opposite of how everyone says it aloud.
   * Optional: a gym is listed and sellable before anyone has placed its pin,
   * it just cannot appear in a "nearest first" list until it has.
   */
  @Prop({ type: GeoPointSchema, default: undefined })
  location?: GeoPoint;
}

export type GymDocument = Gym & Document<Types.ObjectId>;
export const GymSchema = SchemaFactory.createForClass(Gym);

// Discover searches by name/area on active gyms only.
GymSchema.index({ status: 1, name: "text", area: "text" });
// Backs "nearest first" on discover. Sparse, because a gym without a pin should
// not be indexed at all rather than indexed at a default position.
GymSchema.index({ location: "2dsphere" }, { sparse: true });
