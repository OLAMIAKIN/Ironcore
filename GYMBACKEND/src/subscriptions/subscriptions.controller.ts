import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { PaginationQuery } from "@/common/dto/pagination.dto";
import { temporaryPassword } from "@/common/utils/reference";
import type { AuthUser } from "@/common/types";
import { GymsService } from "@/gyms/gyms.service";
import { ReportsService } from "@/transactions/reports.service";
import { SubscriptionsService } from "@/subscriptions/subscriptions.service";
import { AddMemberDto } from "@/subscriptions/dto/member.dto";
import { PasswordService } from "@/auth/password.service";
import { PlansService } from "@/plans/plans.service";
import { User, type UserDocument } from "@/users/schemas/user.schema";

@Controller()
export class SubscriptionsController {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly subscriptions: SubscriptionsService,
    private readonly reports: ReportsService,
    private readonly gyms: GymsService,
    private readonly plans: PlansService,
    private readonly passwords: PasswordService,
  ) {}

  /** Everything the signed-in member trains at, with their door codes. */
  @Roles("member")
  @Get("me/subscriptions")
  async mine(@CurrentUser() user: AuthUser) {
    return { items: await this.subscriptions.listForMember(user.id) };
  }

  /** A member's own receipts — their money, so their split is shown. */
  @Roles("member")
  @Get("me/payments")
  minePayments(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQuery,
  ) {
    return this.reports.forMember(user.id, query);
  }

  /** The gym's roster, for the front desk. */
  @Roles("owner", "manager")
  @Get("gyms/:gymId/members")
  async roster(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQuery,
  ) {
    await this.gyms.requireStaffGym(gymId, user);
    return this.subscriptions.roster(gymId, query);
  }

  @Roles("owner", "manager")
  @Get("gyms/:gymId/members/expiring")
  async expiring(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.gyms.requireStaffGym(gymId, user);
    return { items: await this.subscriptions.expiringSoon(gymId) };
  }

  /**
   * Adds a member the gym already has, with cover but no payment — a paper
   * register being migrated, or someone signed up at the desk. A brand new
   * account gets a one-time password to hand over; an existing one keeps theirs.
   */
  @Roles("owner", "manager")
  @Post("gyms/:gymId/members")
  async addMember(
    @Param("gymId") gymId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    const gym = await this.gyms.requireStaffGym(gymId, user);
    const plan = await this.plans.requireForGym(dto.planId, gym._id);

    let member = await this.users.findOne({ phone: dto.phone });
    let password: string | undefined;

    if (member && member.role !== "member") {
      throw new ConflictException("That number belongs to a staff account");
    }

    const isNewAccount = !member;

    if (!member) {
      password = temporaryPassword();
      member = await this.users.create({
        name: dto.name.trim(),
        phone: dto.phone,
        role: "member",
        passwordHash: await this.passwords.hash(password),
        // A password a stranger at a desk has read out is not a password.
        mustChangePassword: true,
      });
    }

    const subscription = await this.subscriptions.grant({
      memberId: member._id,
      gymId: gym._id,
      plan: {
        planId: plan._id,
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
      },
      days: dto.daysLeft ?? plan.durationDays,
    });

    return {
      id: member._id.toString(),
      name: member.name,
      // The phone number is also the username — members sign in with it.
      phone: member.phone,
      plan: plan.name,
      expiresAt: subscription.expiresAt,
      // The door code, so the desk can print or text it straight away.
      qrToken: subscription.qrToken,
      /** False when the number already had an account; then there is no password to hand over. */
      isNewAccount,
      // Shown once, so the desk can pass it on. It is never stored in the clear.
      temporaryPassword: password,
    };
  }

  /**
   * Re-issues sign-in details for a member who never got them — the message was
   * lost, or the desk dismissed the card before copying it.
   *
   * The original password cannot be shown again: only its hash was kept, which
   * is the point. So this mints a *new* one, and only while the account has
   * never been signed into. Once the member has logged in the password is
   * theirs, the gym has no business seeing it, and this refuses — they change it
   * from their own account instead.
   */
  @Roles("owner", "manager")
  @Post("gyms/:gymId/members/:memberId/credentials")
  async reissueCredentials(
    @Param("gymId") gymId: string,
    @Param("memberId") memberId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const gym = await this.gyms.requireStaffGym(gymId, user);

    // Scoped through the roster, so one gym cannot mint a password for another
    // gym's member by guessing an id.
    const subscription = await this.subscriptions.requireForGym(
      memberId,
      gym._id,
    );

    const member = await this.users.findById(memberId);
    if (!member || member.role !== "member") {
      throw new NotFoundException("That member is not on your roster");
    }

    if (member.lastLoginAt) {
      throw new ConflictException(
        `${member.name} has already signed in, so their password is their own. Ask them to sign in and use "Change password".`,
      );
    }

    const password = temporaryPassword();
    member.passwordHash = await this.passwords.hash(password);
    member.mustChangePassword = true;
    // Anything issued against the old password stops working.
    member.tokenVersion += 1;
    await member.save();

    return {
      id: member._id.toString(),
      name: member.name,
      phone: member.phone,
      plan: subscription.plan.name,
      qrToken: subscription.qrToken,
      isNewAccount: false,
      temporaryPassword: password,
    };
  }
}
