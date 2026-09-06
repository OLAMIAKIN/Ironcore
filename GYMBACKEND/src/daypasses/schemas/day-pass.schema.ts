import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/** A single-entry guest pass, valid until closing time on the day it is bought. */
@Schema({ timestamps: true, collection: "daypasses" })
export class DayPass {
  @Prop({ type: Types.ObjectId, ref: "Gym", required: true, index: true })
  gymId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token!: string;

  @Prop({ type: Types.ObjectId, ref: "User", index: true })
  buyerId?: Types.ObjectId;

  @Prop({ trim: true, maxlength: 80 })
  buyerName?: string;

  @Prop({ required: true })
  validUntil!: Date;

  /** Set the first time it is scanned; a second scan is refused. */
  @Prop()
  usedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "Transaction", required: true })
  transactionId!: Types.ObjectId;
}

export type DayPassDocument = DayPass & Document<Types.ObjectId>;
export const DayPassSchema = SchemaFactory.createForClass(DayPass);

DayPassSchema.index({ gymId: 1, createdAt: -1 });
