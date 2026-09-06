import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import type { Role } from "@/common/types";

/**
 * One account per phone number. Members have no gym on the account — the gyms
 * they train at come from their subscriptions; staff belong to exactly one.
 */
@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  /** Normalised digits, e.g. "08032147765". */
  @Prop({ required: true, unique: true, index: true })
  phone!: string;

  @Prop({ trim: true, lowercase: true, maxlength: 160 })
  email?: string;

  /** Argon2id hash. Never selected unless a query asks for it explicitly. */
  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({
    required: true,
    enum: ["member", "owner", "manager", "scanner"],
    index: true,
  })
  role!: Role;

  @Prop({ type: Types.ObjectId, ref: "Gym", index: true })
  gymId?: Types.ObjectId;

  /** Bumped on password change, which invalidates every issued access token. */
  @Prop({ default: 0 })
  tokenVersion!: number;

  @Prop({ default: 0 })
  failedLogins!: number;

  /** Set after repeated failures; sign-in refuses until it passes. */
  @Prop()
  lockedUntil?: Date;

  @Prop({ default: "active", enum: ["active", "disabled"], index: true })
  status!: "active" | "disabled";

  @Prop()
  lastLoginAt?: Date;

  /**
   * Set when a gym creates the account on someone's behalf, so the password is
   * one a stranger at a desk has seen. The app makes them replace it before
   * anything else, and clears this once they have.
   */
  @Prop({ default: false })
  mustChangePassword!: boolean;
}

export type UserDocument = User & Document<Types.ObjectId>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ gymId: 1, role: 1 });
