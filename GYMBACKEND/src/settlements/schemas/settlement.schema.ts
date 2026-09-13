import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * A payout run: the gym's share of a batch of successful payments, sent to the
 * gym's own bank account. IronCore holds no balance in between.
 */
@Schema({ timestamps: true, collection: "settlements" })
export class Settlement {
  @Prop({ type: Types.ObjectId, ref: "Gym", required: true, index: true })
  gymId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  reference!: string;

  /** Sum of gymNet across the batch. */
  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, default: 0 })
  transactionCount!: number;

  @Prop({
    required: true,
    enum: ["processing", "paid", "failed"],
    default: "processing",
    index: true,
  })
  status!: "processing" | "paid" | "failed";

  /** Snapshot of where it went, so a later account change is not retroactive. */
  @Prop({ required: true })
  bankName!: string;

  @Prop({ required: true })
  accountLast4!: string;

  @Prop()
  paidAt?: Date;

  /**
   * The gateway's own id for this payout, when it came from the gateway rather
   * than being simulated by the sandbox. Unique, so re-reading the same payout
   * cannot record it twice.
   */
  @Prop({ index: true, sparse: true, unique: true })
  providerSettlementId?: string;
}

export type SettlementDocument = Settlement & Document<Types.ObjectId>;
export const SettlementSchema = SchemaFactory.createForClass(Settlement);

SettlementSchema.index({ gymId: 1, createdAt: -1 });
