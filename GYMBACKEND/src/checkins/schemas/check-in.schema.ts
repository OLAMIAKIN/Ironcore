import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/** Every door scan, allowed or not — the front desk's audit trail. */
@Schema({ timestamps: true, collection: "checkins" })
export class CheckIn {
  @Prop({ type: Types.ObjectId, ref: "Gym", required: true, index: true })
  gymId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User" })
  memberId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "DayPass" })
  dayPassId?: Types.ObjectId;

  /** Kept even for unknown codes, which is exactly when it is worth having. */
  @Prop({ required: true, maxlength: 64 })
  token!: string;

  @Prop({ required: true })
  allowed!: boolean;

  @Prop({ required: true, maxlength: 160 })
  reason!: string;

  @Prop({ required: true, enum: ["member", "day_pass", "unknown"] })
  kind!: "member" | "day_pass" | "unknown";

  @Prop({ trim: true, maxlength: 80 })
  who?: string;

  @Prop({ type: Types.ObjectId, ref: "User" })
  scannedBy?: Types.ObjectId;
}

export type CheckInDocument = CheckIn & Document<Types.ObjectId>;
export const CheckInSchema = SchemaFactory.createForClass(CheckIn);

CheckInSchema.index({ gymId: 1, createdAt: -1 });
