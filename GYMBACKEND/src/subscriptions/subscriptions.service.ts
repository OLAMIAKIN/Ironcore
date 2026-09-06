import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage, Types } from "mongoose";
import { accessToken } from "@/common/utils/reference";
import {
  paginate,
  type Paginated,
  type PaginationQuery,
} from "@/common/dto/pagination.dto";
import {
  Subscription,
  type SubscriptionDocument,
} from "@/subscriptions/schemas/subscription.schema";

export type MemberSubscription = {
  id: string;
  gym: { id: string; name: string; branch: string; area: string };
  plan: { id: string; name: string; price: number; durationDays: number };
  status: Subscription["status"];
  expiresAt?: Date;
  daysLeft: number;
  autoRenew: boolean;
  qrToken: string;
};

export type RosterRow = {
  id: string;
  memberId: string;
  name: string;
  phone: string;
  plan: string;
  status: Subscription["status"];
  expiresAt?: Date;
  daysLeft: number;
};

/** Whole days from now until `date`, floored at zero. */
export function daysUntil(date: Date | undefined): number {
  if (!date) return 0;
  const ms = date.getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<SubscriptionDocument>,
  ) {}

  /**
   * Applies a paid renewal. Time is added to whatever is left rather than
   * replacing it, so renewing early never costs the member days.
   */
  async applyRenewal(input: {
    memberId: Types.ObjectId;
    gymId: Types.ObjectId;
    plan: { planId: Types.ObjectId; name: string; price: number; durationDays: number };
  }): Promise<SubscriptionDocument> {
    const existing = await this.subscriptions.findOne({
      memberId: input.memberId,
      gymId: input.gymId,
    });

    const now = new Date();
    const base =
      existing?.expiresAt && existing.expiresAt.getTime() > now.getTime()
        ? existing.expiresAt
        : now;

    const expiresAt = new Date(
      base.getTime() + input.plan.durationDays * 24 * 60 * 60 * 1000,
    );

    if (existing) {
      existing.plan = input.plan;
      existing.status = "active";
      existing.startedAt = existing.startedAt ?? now;
      existing.expiresAt = expiresAt;
      await existing.save();
      return existing;
    }

    return this.subscriptions.create({
      memberId: input.memberId,
      gymId: input.gymId,
      plan: input.plan,
      status: "active",
      startedAt: now,
      expiresAt,
      qrToken: accessToken("MBR"),
    });
  }

  /**
   * Grants cover directly, for a member the gym already had. Deliberately
   * separate from `applyRenewal`: nothing here writes to the ledger, because no
   * money moved through the platform.
   */
  async grant(input: {
    memberId: Types.ObjectId;
    gymId: Types.ObjectId;
    plan: {
      planId: Types.ObjectId;
      name: string;
      price: number;
      durationDays: number;
    };
    days: number;
  }): Promise<SubscriptionDocument> {
    const expiresAt = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);

    const existing = await this.subscriptions.findOne({
      memberId: input.memberId,
      gymId: input.gymId,
    });

    if (existing) {
      existing.plan = input.plan;
      existing.status = "active";
      existing.startedAt = existing.startedAt ?? new Date();
      // Never shorten cover the member has already paid for.
      if (!existing.expiresAt || existing.expiresAt < expiresAt) {
        existing.expiresAt = expiresAt;
      }
      await existing.save();
      return existing;
    }

    return this.subscriptions.create({
      memberId: input.memberId,
      gymId: input.gymId,
      plan: input.plan,
      status: "active",
      startedAt: new Date(),
      expiresAt,
      qrToken: accessToken("MBR"),
    });
  }

  /** Everything the signed-in member trains at, newest first. */
  async listForMember(memberId: string): Promise<MemberSubscription[]> {
    const rows = await this.subscriptions
      .find({ memberId: new Types.ObjectId(memberId) })
      .populate<{ gymId: { _id: Types.ObjectId; name: string; branch: string; area: string } }>(
        "gymId",
        "name branch area",
      )
      .sort({ updatedAt: -1 })
      .lean();

    return rows.map((row) => {
      const gym = row.gymId as unknown as {
        _id: Types.ObjectId;
        name: string;
        branch: string;
        area: string;
      };

      return {
        id: row._id.toString(),
        gym: {
          id: gym._id.toString(),
          name: gym.name,
          branch: gym.branch,
          area: gym.area,
        },
        plan: {
          id: row.plan.planId.toString(),
          name: row.plan.name,
          price: row.plan.price,
          durationDays: row.plan.durationDays,
        },
        status: statusOf(row),
        expiresAt: row.expiresAt,
        daysLeft: daysUntil(row.expiresAt),
        autoRenew: row.autoRenew,
        qrToken: row.qrToken,
      };
    });
  }

  async findByToken(
    gymId: Types.ObjectId,
    token: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subscriptions.findOne({ gymId, qrToken: token.toUpperCase() });
  }

  /** The owner's roster: one row per member of this gym. */
  async roster(
    gymId: string,
    query: PaginationQuery,
  ): Promise<Paginated<RosterRow>> {
    const match: Record<string, unknown> = { gymId: new Types.ObjectId(gymId) };

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: "users",
          localField: "memberId",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: "$member" },
    ];

    if (query.q) {
      const safe = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pipeline.push({
        $match: {
          $or: [
            { "member.name": { $regex: safe, $options: "i" } },
            { "member.phone": { $regex: safe, $options: "i" } },
          ],
        },
      });
    }

    const [result] = await this.subscriptions.aggregate<{
      items: (SubscriptionDocument & {
        member: { _id: Types.ObjectId; name: string; phone: string };
      })[];
      total: { count: number }[];
    }>([
      ...pipeline,
      {
        $facet: {
          items: [
            { $sort: { expiresAt: 1 } },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
          ],
          total: [{ $count: "count" }],
        },
      } satisfies PipelineStage.Facet,
    ]);

    const items = (result?.items ?? []).map((row) => ({
      id: row._id.toString(),
      memberId: row.member._id.toString(),
      name: row.member.name,
      phone: row.member.phone,
      plan: row.plan.name,
      status: statusOf(row),
      expiresAt: row.expiresAt,
      daysLeft: daysUntil(row.expiresAt),
    }));

    return paginate(items, result?.total[0]?.count ?? 0, query);
  }

  /** Members whose cover runs out inside the next `days` days. */
  async expiringSoon(gymId: string, days = 7): Promise<RosterRow[]> {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const rows = await this.subscriptions.aggregate<{
      _id: Types.ObjectId;
      plan: { name: string };
      status: Subscription["status"];
      expiresAt?: Date;
      member: { _id: Types.ObjectId; name: string; phone: string };
    }>([
      {
        $match: {
          gymId: new Types.ObjectId(gymId),
          status: "active",
          expiresAt: { $lte: cutoff },
        },
      },
      { $sort: { expiresAt: 1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "memberId",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: "$member" },
    ]);

    return rows.map((row) => ({
      id: row._id.toString(),
      memberId: row.member._id.toString(),
      name: row.member.name,
      phone: row.member.phone,
      plan: row.plan.name,
      status: row.status,
      expiresAt: row.expiresAt,
      daysLeft: daysUntil(row.expiresAt),
    }));
  }

  async countActive(gymId: string): Promise<number> {
    return this.subscriptions.countDocuments({
      gymId: new Types.ObjectId(gymId),
      status: "active",
      expiresAt: { $gt: new Date() },
    });
  }

  async requireForMember(
    subscriptionId: string,
    memberId: string,
  ): Promise<SubscriptionDocument> {
    const row = await this.subscriptions.findOne({
      _id: new Types.ObjectId(subscriptionId),
      memberId: new Types.ObjectId(memberId),
    });
    if (!row) throw new NotFoundException("Subscription not found");
    return row;
  }
}

/** Stored status, corrected for the clock — nothing runs a nightly job. */
function statusOf(row: {
  status: Subscription["status"];
  expiresAt?: Date;
}): Subscription["status"] {
  if (row.status === "active" && row.expiresAt && row.expiresAt < new Date()) {
    return "expired";
  }
  return row.status;
}
