import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { GymsService } from "@/gyms/gyms.service";
import { PasswordService } from "@/auth/password.service";
import type { TokenSubject } from "@/auth/tokens.service";
import { User, type UserDocument } from "@/users/schemas/user.schema";
import type {
  LoginDto,
  RegisterGymDto,
  RegisterMemberDto,
} from "@/auth/dto/auth.dto";
import type { Role } from "@/common/types";

/** Five wrong passwords buys a fifteen minute pause on that account. */
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

export type PublicUser = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  gymId?: string;
  /** True while they are still on a password a gym's front desk chose for them. */
  mustChangePassword: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly passwords: PasswordService,
    private readonly gyms: GymsService,
  ) {}

  async registerMember(dto: RegisterMemberDto): Promise<UserDocument> {
    await this.assertPhoneIsFree(dto.phone);

    return this.users.create({
      name: dto.name.trim(),
      phone: dto.phone,
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
      role: "member",
    });
  }

  /**
   * Creates the owner and their draft gym in one step. If gym creation fails
   * the half-made owner is removed, so a retry is not blocked by their own
   * phone number.
   */
  async registerGym(
    dto: RegisterGymDto,
  ): Promise<{ owner: UserDocument; gymId: Types.ObjectId }> {
    await this.assertPhoneIsFree(dto.phone);

    const owner = await this.users.create({
      name: dto.ownerName.trim(),
      phone: dto.phone,
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
      role: "owner",
    });

    try {
      const gym = await this.gyms.createDraft(
        {
          name: dto.gymName.trim(),
          branch: dto.branch.trim(),
          area: dto.area.trim(),
          dayPassPrice: dto.dayPassPrice,
        },
        owner._id,
      );

      owner.gymId = gym._id;
      await owner.save();

      return { owner, gymId: gym._id };
    } catch (error) {
      await this.users.deleteOne({ _id: owner._id });
      throw error;
    }
  }

  /**
   * One sign-in for members and staff alike. Every failure returns the same
   * message, so the response cannot be used to discover which numbers have
   * accounts.
   */
  async login(dto: LoginDto): Promise<UserDocument> {
    const user = await this.users
      .findOne({ phone: dto.phone })
      .select("+passwordHash");

    const rejection = new UnauthorizedException(
      "That phone number and password do not match",
    );

    if (!user || user.status !== "active") throw rejection;

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(
        "Too many attempts. Try again in a few minutes.",
      );
    }

    const ok = await this.passwords.verify(user.passwordHash, dto.password);

    if (!ok) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
        user.failedLogins = 0;
      }
      await user.save();
      throw rejection;
    }

    user.failedLogins = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findById(userId).select("+passwordHash");
    if (!user) throw new UnauthorizedException("Account is unavailable");

    const ok = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!ok) throw new UnauthorizedException("Your current password is wrong");

    user.passwordHash = await this.passwords.hash(newPassword);
    // Every access token issued before now stops verifying.
    user.tokenVersion += 1;
    // Whatever the desk handed them is now theirs alone.
    user.mustChangePassword = false;
    await user.save();
  }

  /** Used by the refresh flow to rebuild claims from the current record. */
  async subjectOf(userId: Types.ObjectId): Promise<TokenSubject | null> {
    const user = await this.users.findById(userId).lean();
    if (!user || user.status !== "active") return null;

    return {
      id: user._id,
      role: user.role,
      gymId: user.gymId,
      tokenVersion: user.tokenVersion,
    };
  }

  async findById(userId: string): Promise<UserDocument | null> {
    return this.users.findById(userId);
  }

  toPublic(user: UserDocument): PublicUser {
    return {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      gymId: user.gymId?.toString(),
      mustChangePassword: user.mustChangePassword === true,
    };
  }

  private async assertPhoneIsFree(phone: string): Promise<void> {
    const existing = await this.users.exists({ phone });
    if (existing) {
      throw new ConflictException("That phone number already has an account");
    }
  }
}
