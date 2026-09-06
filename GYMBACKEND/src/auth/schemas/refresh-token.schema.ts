import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * One row per issued refresh token. Only a SHA-256 of the token is stored, so a
 * database leak cannot be replayed as a session. Rotation links rows into a
 * family; presenting an already-rotated token revokes the whole family, which
 * is how a stolen token gets caught.
 */
@Schema({ timestamps: true, collection: "refresh_tokens" })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  /** Shared by every token descended from one sign-in. */
  @Prop({ required: true, index: true })
  family!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  revokedAt?: Date;

  @Prop()
  replacedByHash?: string;

  @Prop({ maxlength: 200 })
  userAgent?: string;

  @Prop({ maxlength: 64 })
  ip?: string;
}

export type RefreshTokenDocument = RefreshToken & Document<Types.ObjectId>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Mongo sweeps expired sessions on its own; nothing to clean up by hand.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
