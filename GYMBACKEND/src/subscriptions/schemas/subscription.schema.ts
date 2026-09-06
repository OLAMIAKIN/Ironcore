import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/** The plan as it was when bought, so later price edits cannot rewrite history. */
@Schema({ _id: false })
export class PlanSnapshot {
  @Prop({ type: Types.ObjectId, ref: "Plan", required: true })
  planId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  price!: number;

  @Prop({ required: true })
  durationDays!: number;
}

@Schema({ timestamps: true, collection: "subscriptions" })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  memberId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Gym", required: true, index: true })
  gymId!: Types.ObjectId;

  @Prop({ type: PlanSnapshot, required: true })
  plan!: PlanSnapshot;

  @Prop({
    required: true,
    enum: ["pending", "active", "expired", "cancelled"],
    default: "pending",
    index: true,
  })
  status!: "pending" | "active" | "expired" | "cancelled";

  @Prop()
  startedAt?: Date;

  /** Renewals extend this; they never reset it. */
  @Prop({ index: true })
  expiresAt?: Date;

  @Prop({ default: true })
  autoRenew!: boolean;

  /** What the member shows at the door. Rotated if it ever leaks. */
  @Prop({ required: true, unique: true })
  qrToken!: string;
}

export type SubscriptionDocument = Subscription & Document<Types.ObjectId>;
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// One subscription row per member per gym; renewals update it in place.
SubscriptionSchema.index({ memberId: 1, gymId: 1 }, { unique: true });
// Backs the owner's "expiring this week" list.
SubscriptionSchema.index({ gymId: 1, status: 1, expiresAt: 1 });
