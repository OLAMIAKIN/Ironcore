import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { paymentReference } from "@/common/utils/reference";
import { Gym, type GymDocument } from "@/gyms/schemas/gym.schema";
import {
  Settlement,
  type SettlementDocument,
} from "@/settlements/schemas/settlement.schema";
import {
  Transaction,
  type TransactionDocument,
} from "@/transactions/schemas/transaction.schema";

/** Payments are paid out the next working day, the way a real gateway settles. */
const SETTLEMENT_DELAY_HOURS = 24;
const SWEEP_INTERVAL_MS = 10 * 60_000;

export type SettlementRow = {
  id: string;
  reference: string;
  amount: number;
  payments: number;
  status: Settlement["status"];
  bankName: string;
  accountLast4: string;
  paidAt?: Date;
  createdAt?: Date;
};

/**
 * Moves confirmed payments from "pending settlement" to "settled to your bank".
 *
 * The two states are deliberately distinct and neither is a balance: IronCore
 * never holds the gym's money, it only records when the payout ran.
 */
@Injectable()
export class SettlementsService implements OnModuleInit {
  private readonly logger = new Logger("Settlements");
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectModel(Settlement.name)
    private readonly settlements: Model<SettlementDocument>,
    @InjectModel(Transaction.name)
    private readonly transactions: Model<TransactionDocument>,
    @InjectModel(Gym.name) private readonly gyms: Model<GymDocument>,
  ) {}

  onModuleInit(): void {
    // A small in-process sweep. A deployment with more than one instance would
    // move this to a scheduled worker; the logic below is already idempotent.
    this.timer = setInterval(() => {
      void this.runDue().catch((error: unknown) =>
        this.logger.error("Sweep failed", String(error)),
      );
    }, SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Settles everything that has been sitting long enough, gym by gym. */
  async runDue(): Promise<number> {
    const cutoff = new Date(Date.now() - SETTLEMENT_DELAY_HOURS * 60 * 60_000);

    const due = await this.transactions.aggregate<{
      _id: Types.ObjectId;
      amount: number;
      ids: Types.ObjectId[];
    }>([
      {
        $match: {
          status: "success",
          settlementStatus: "pending",
          paidAt: { $lte: cutoff },
        },
      },
      {
        $group: {
          _id: "$gymId",
          amount: { $sum: "$gymNet" },
          ids: { $push: "$_id" },
        },
      },
    ]);

    let batches = 0;

    for (const group of due) {
      const gym = await this.gyms.findById(group._id).lean();
      if (!gym?.settlementAccount) continue;

      const settlement = await this.settlements.create({
        gymId: group._id,
        reference: paymentReference("STL"),
        amount: group.amount,
        transactionCount: group.ids.length,
        status: "paid",
        bankName: gym.settlementAccount.bankName,
        accountLast4: gym.settlementAccount.accountNumber.slice(-4),
        paidAt: new Date(),
      });

      // Conditioned on the pending status, so a concurrent sweep cannot pay
      // the same transaction twice.
      await this.transactions.updateMany(
        { _id: { $in: group.ids }, settlementStatus: "pending" },
        {
          $set: {
            settlementStatus: "settled",
            settledAt: settlement.paidAt,
            settlementId: settlement._id,
          },
        },
      );

      batches += 1;
    }

    if (batches) this.logger.log(`Settled ${batches} batch(es)`);
    return batches;
  }

  async listForGym(gymId: string, limit = 10): Promise<SettlementRow[]> {
    const rows = await this.settlements
      .find({ gymId: new Types.ObjectId(gymId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return rows.map((row) => ({
      id: row._id.toString(),
      reference: row.reference,
      amount: row.amount,
      payments: row.transactionCount,
      status: row.status,
      bankName: row.bankName,
      accountLast4: row.accountLast4,
      paidAt: row.paidAt,
      createdAt: (row as { createdAt?: Date }).createdAt,
    }));
  }
}
