import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DayPassesService } from "@/daypasses/daypasses.service";
import {
  daysUntil,
  SubscriptionsService,
} from "@/subscriptions/subscriptions.service";
import { CheckIn, type CheckInDocument } from "@/checkins/schemas/check-in.schema";
import { User, type UserDocument } from "@/users/schemas/user.schema";

export type ScanResult = {
  allowed: boolean;
  /** Headline for the gate screen. */
  status: string;
  /** Who this code belongs to, and why it passed or failed. */
  detail: string;
  kind: "member" | "day_pass" | "unknown";
  /** True when paying would fix it — the front desk can offer a renewal. */
  offerRenewal?: boolean;
  /**
   * Who to chase, when a renewal would fix it. There is no email or SMS gateway
   * wired up, so the desk contacts them directly — which means the desk needs
   * the number in front of it. Only ever filled in for this gym's own member.
   */
  contact?: { name: string; phone: string };
};

/**
 * The door rule. Nothing here trusts the scanner's own opinion of a code: the
 * token is looked up against this gym only, so a code from another branch is
 * simply unknown.
 */
@Injectable()
export class CheckInsService {
  constructor(
    @InjectModel(CheckIn.name) private readonly checkIns: Model<CheckInDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly subscriptions: SubscriptionsService,
    private readonly dayPasses: DayPassesService,
  ) {}

  async scan(
    gymId: string,
    rawToken: string,
    staffId: string,
  ): Promise<ScanResult> {
    const gym = new Types.ObjectId(gymId);
    const token = rawToken.trim().toUpperCase().slice(0, 64);

    const result = await this.decide(gym, token);

    await this.checkIns.create({
      gymId: gym,
      token,
      allowed: result.allowed,
      reason: result.detail,
      kind: result.kind,
      who: result.who,
      memberId: result.memberId,
      dayPassId: result.dayPassId,
      scannedBy: new Types.ObjectId(staffId),
    });

    return {
      allowed: result.allowed,
      status: result.status,
      detail: result.detail,
      kind: result.kind,
      offerRenewal: result.offerRenewal,
      contact: result.contact,
    };
  }

  private async decide(
    gymId: Types.ObjectId,
    token: string,
  ): Promise<
    ScanResult & {
      who?: string;
      memberId?: Types.ObjectId;
      dayPassId?: Types.ObjectId;
    }
  > {
    const subscription = await this.subscriptions.findByToken(gymId, token);

    if (subscription) {
      const member = await this.users.findById(subscription.memberId).lean();
      const who = member?.name ?? "Member";
      const left = daysUntil(subscription.expiresAt);

      if (subscription.status !== "active" || left === 0) {
        return {
          allowed: false,
          status: "Membership expired",
          detail: `${who} · plan has run out`,
          kind: "member",
          offerRenewal: true,
          contact: member?.phone
            ? { name: who, phone: member.phone }
            : undefined,
          who,
          memberId: subscription.memberId,
        };
      }

      return {
        allowed: true,
        status: "Entry allowed",
        detail: `${who} · ${subscription.plan.name} plan · ${left} day${left === 1 ? "" : "s"} left`,
        kind: "member",
        who,
        memberId: subscription.memberId,
      };
    }

    const pass = await this.dayPasses.findByToken(gymId, token);

    if (pass) {
      if (pass.validUntil.getTime() < Date.now()) {
        return {
          allowed: false,
          status: "Pass expired",
          detail: `${pass.buyerName ?? "Guest"} · this pass was for another day`,
          kind: "day_pass",
          who: pass.buyerName,
          dayPassId: pass._id,
        };
      }

      const consumed = await this.dayPasses.consume(pass._id);

      if (!consumed) {
        return {
          allowed: false,
          status: "Pass already used",
          detail: `${pass.buyerName ?? "Guest"} · single entry, already scanned`,
          kind: "day_pass",
          who: pass.buyerName,
          dayPassId: pass._id,
        };
      }

      return {
        allowed: true,
        status: "Entry allowed",
        detail: `${pass.buyerName ?? "Guest"} · day pass, valid today`,
        kind: "day_pass",
        who: pass.buyerName,
        dayPassId: pass._id,
      };
    }

    return {
      allowed: false,
      status: "Code not recognised",
      detail: "Ask for a phone number and look the member up manually.",
      kind: "unknown",
    };
  }

  async recent(gymId: string, limit = 8) {
    const rows = await this.checkIns
      .find({ gymId: new Types.ObjectId(gymId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return rows.map((row) => ({
      id: row._id.toString(),
      who: row.who ?? row.token,
      kind: row.kind === "day_pass" ? "Day pass" : "Member",
      allowed: row.allowed,
      at: (row as { createdAt?: Date }).createdAt,
    }));
  }

  async countToday(gymId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    return this.checkIns.countDocuments({
      gymId: new Types.ObjectId(gymId),
      allowed: true,
      createdAt: { $gte: start },
    });
  }
}
