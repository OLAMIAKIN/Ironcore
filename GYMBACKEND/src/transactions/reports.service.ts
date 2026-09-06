import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, PipelineStage, Types } from "mongoose";
import {
  paginate,
  type Paginated,
  type PaginationQuery,
} from "@/common/dto/pagination.dto";
import {
  Transaction,
  type TransactionDocument,
} from "@/transactions/schemas/transaction.schema";

/**
 * The owner's view of the money.
 *
 * Every figure here is the gym's own share. The platform fee and the gross
 * amount are deliberately absent from these types and from the aggregations
 * that build them, so there is nothing for the network tab to reveal either.
 */

export type OwnerSummary = {
  /** What the gym earned in the period, after the split. */
  earned: number;
  /** Confirmed payments whose payout has not run yet. */
  pendingSettlement: number;
  /** Already paid out to the gym's bank. */
  settled: number;
  payments: number;
  activeMembers?: number;
};

export type OwnerTransactionRow = {
  id: string;
  member: string;
  kind: "Renewal" | "Day pass";
  /** The gym's share — the only amount an owner endpoint returns. */
  amount: number;
  status: "pending" | "settled";
  date: Date;
};

export type DailyPoint = { date: string; amount: number };

/** Successful member money for one gym. Listing payments are never included. */
function ownerMatch(gymId: string, since?: Date): PipelineStage.Match {
  const match: Record<string, unknown> = {
    gymId: new Types.ObjectId(gymId),
    status: "success",
    purpose: { $in: ["subscription", "day_pass"] },
  };
  if (since) match.paidAt = { $gte: since };
  return { $match: match };
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactions: Model<TransactionDocument>,
  ) {}

  async summary(gymId: string, days: number): Promise<OwnerSummary> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [row] = await this.transactions.aggregate<{
      earned: number;
      pendingSettlement: number;
      settled: number;
      payments: number;
    }>([
      ownerMatch(gymId, since),
      {
        $group: {
          _id: null,
          earned: { $sum: "$gymNet" },
          pendingSettlement: {
            $sum: {
              $cond: [{ $eq: ["$settlementStatus", "pending"] }, "$gymNet", 0],
            },
          },
          settled: {
            $sum: {
              $cond: [{ $eq: ["$settlementStatus", "settled"] }, "$gymNet", 0],
            },
          },
          payments: { $sum: 1 },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return (
      row ?? { earned: 0, pendingSettlement: 0, settled: 0, payments: 0 }
    );
  }

  /** Today's takings for the dashboard tile — again, the gym's share only. */
  async today(gymId: string): Promise<{ earned: number; payments: number }> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [row] = await this.transactions.aggregate<{
      earned: number;
      payments: number;
    }>([
      {
        $match: {
          gymId: new Types.ObjectId(gymId),
          status: "success",
          purpose: { $in: ["subscription", "day_pass"] },
          paidAt: { $gte: start },
        },
      },
      {
        $group: { _id: null, earned: { $sum: "$gymNet" }, payments: { $sum: 1 } },
      },
      { $project: { _id: 0 } },
    ]);

    return row ?? { earned: 0, payments: 0 };
  }

  async daily(gymId: string, days: number): Promise<DailyPoint[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await this.transactions.aggregate<{
      _id: string;
      amount: number;
    }>([
      ownerMatch(gymId, since),
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$paidAt" },
          },
          amount: { $sum: "$gymNet" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return rows.map((row) => ({ date: row._id, amount: row.amount }));
  }

  async list(
    gymId: string,
    query: PaginationQuery,
    days: number,
  ): Promise<Paginated<OwnerTransactionRow>> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [result] = await this.transactions.aggregate<{
      items: {
        _id: Types.ObjectId;
        payerName?: string;
        purpose: string;
        gymNet: number;
        settlementStatus: string;
        paidAt: Date;
      }[];
      total: { count: number }[];
    }>([
      ownerMatch(gymId, since),
      {
        $facet: {
          items: [
            { $sort: { paidAt: -1 } },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            {
              $project: {
                payerName: 1,
                purpose: 1,
                gymNet: 1,
                settlementStatus: 1,
                paidAt: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]);

    const items: OwnerTransactionRow[] = (result?.items ?? []).map((row) => ({
      id: row._id.toString(),
      member: row.payerName ?? "Guest",
      kind: row.purpose === "day_pass" ? "Day pass" : "Renewal",
      amount: row.gymNet,
      status: row.settlementStatus === "settled" ? "settled" : "pending",
      date: row.paidAt,
    }));

    return paginate(items, result?.total[0]?.count ?? 0, query);
  }

  /** A member's own receipts, where the split is theirs to see. */
  async forMember(
    memberId: string,
    query: PaginationQuery,
  ): Promise<Paginated<Record<string, unknown>>> {
    const filter = {
      payerId: new Types.ObjectId(memberId),
      status: "success" as const,
    };

    const [rows, total] = await Promise.all([
      this.transactions
        .find(filter)
        .sort({ paidAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.transactions.countDocuments(filter),
    ]);

    const items = rows.map((row) => ({
      id: row._id.toString(),
      reference: row.reference,
      purpose: row.purpose,
      amount: row.gross,
      gymNet: row.gymNet,
      platformFee: row.platformFee,
      channel: row.channel,
      paidAt: row.paidAt,
    }));

    return paginate(items, total, query);
  }
}
