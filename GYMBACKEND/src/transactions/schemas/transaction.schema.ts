import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type TransactionPurpose = "subscription" | "day_pass" | "listing";
export type TransactionStatus = "pending" | "success" | "failed" | "abandoned";
export type SettlementStatus = "not_applicable" | "pending" | "settled";

/**
 * The money ledger. One row per payment attempt, written before the payer is
 * sent to the gateway and only ever moved forward: pending → success | failed.
 */
@Schema({ timestamps: true, collection: "transactions" })
export class Transaction {
  /** Server-generated and unguessable; the client never supplies one. */
  @Prop({ required: true, unique: true })
  reference!: string;

  @Prop({ index: true })
  providerReference?: string;

  @Prop({ required: true, enum: ["mock", "paystack"] })
  provider!: "mock" | "paystack";

  @Prop({
    required: true,
    enum: ["subscription", "day_pass", "listing"],
    index: true,
  })
  purpose!: TransactionPurpose;

  /** Absent on listing payments, which are owed to the platform, not a gym. */
  @Prop({ type: Types.ObjectId, ref: "Gym", index: true })
  gymId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", index: true })
  payerId?: Types.ObjectId;

  /** Denormalised so the owner's table needs no join to show a name. */
  @Prop({ trim: true, maxlength: 80 })
  payerName?: string;

  @Prop({ required: true, min: 0 })
  gross!: number;

  @Prop({ required: true, min: 0 })
  platformFee!: number;

  @Prop({ required: true, min: 0 })
  gymNet!: number;

  /**
   * What the gateway was expected to take, added on top of the price so the gym
   * still receives what it quoted. Zero in the sandbox.
   */
  @Prop({ required: true, min: 0, default: 0 })
  gatewayFee!: number;

  /**
   * What the gateway actually took, read back from it after the payment. Any
   * gap between this and `gatewayFee` is a mispriced fee model, and is worth
   * knowing about rather than quietly absorbing.
   */
  @Prop({ min: 0 })
  gatewayFeeActual?: number;

  @Prop({ required: true, default: "NGN" })
  currency!: string;

  @Prop({ enum: ["card", "opay", "transfer"], required: true })
  channel!: "card" | "opay" | "transfer";

  @Prop({
    required: true,
    enum: ["pending", "success", "failed", "abandoned"],
    default: "pending",
    index: true,
  })
  status!: TransactionStatus;

  @Prop({
    required: true,
    enum: ["not_applicable", "pending", "settled"],
    default: "not_applicable",
    index: true,
  })
  settlementStatus!: SettlementStatus;

  @Prop()
  settledAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "Settlement" })
  settlementId?: Types.ObjectId;

  @Prop()
  paidAt?: Date;

  @Prop({ maxlength: 240 })
  failureReason?: string;

  /** Purpose-specific ids: planId, subscriptionId, listing plan and so on. */
  @Prop({ type: Object, default: {} })
  metadata!: Record<string, string>;
}

export type TransactionDocument = Transaction & Document<Types.ObjectId>;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// The owner's ledger view: one gym, newest first, optionally filtered.
TransactionSchema.index({ gymId: 1, status: 1, createdAt: -1 });
TransactionSchema.index({ gymId: 1, settlementStatus: 1, paidAt: -1 });
TransactionSchema.index({ payerId: 1, createdAt: -1 });
