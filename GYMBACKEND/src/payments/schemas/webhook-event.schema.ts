import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * Gateways retry. Recording each event id means a repeated delivery is a no-op
 * rather than a second renewal.
 */
@Schema({ timestamps: true, collection: "webhook_events" })
export class WebhookEvent {
  @Prop({ required: true, unique: true })
  eventId!: string;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  type!: string;

  @Prop()
  reference?: string;
}

export type WebhookEventDocument = WebhookEvent & Document<Types.ObjectId>;
export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

WebhookEventSchema.index({ createdAt: -1 });
