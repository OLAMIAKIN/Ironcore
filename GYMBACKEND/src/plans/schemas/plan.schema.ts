import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/** A membership plan sold by one gym. Prices are whole naira. */
@Schema({ timestamps: true, collection: "plans" })
export class Plan {
  @Prop({ type: Types.ObjectId, ref: "Gym", required: true, index: true })
  gymId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 40 })
  name!: string;

  @Prop({ required: true, min: 500, max: 10_000_000 })
  price!: number;

  @Prop({ required: true, min: 1, max: 1095 })
  durationDays!: number;

  @Prop({ trim: true, maxlength: 160 })
  perks?: string;

  @Prop({ default: false })
  popular!: boolean;

  @Prop({ default: true, index: true })
  active!: boolean;
}

export type PlanDocument = Plan & Document<Types.ObjectId>;
export const PlanSchema = SchemaFactory.createForClass(Plan);

PlanSchema.index({ gymId: 1, active: 1, price: 1 });
