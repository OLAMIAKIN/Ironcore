import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { paymentReference } from "@/common/utils/reference";
import {
  PAYMENTS_PROVIDER,
  type PaymentsProvider,
} from "@/payments/providers/provider.port";
import { Gym, type GymDocument } from "@/gyms/schemas/gym.schema";
import {
  Settlement,
  type SettlementDocument,
} from "@/settlements/schemas/settlement.schema";
import {
  Transaction,
  type TransactionDocument,
} from "@/transactions/schemas/transaction.schema";

/**
 * Only used by the sandbox, which has no gateway to ask. The real adapter reads
 * actual payouts and this number means nothing to it.
 */
const SANDBOX_DELAY_HOURS = 24;

const SWEEP_INTERVAL_MS = 10 * 60_000;

/** How far back to ask the gateway for payouts on each sweep. */
const RECONCILE_WINDOW_DAYS = 14;

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
 * Records when the gateway actually paid a gym out.
 *
 * This used to be a timer: anything older than a day was called "settled". That
 * was a guess dressed as a fact — it would report a gym as paid while the
 * gateway was holding the money back, which is exactly the sort of thing an
 * owner reconciles against their bank statement and stops trusting you over.
 *
 * Now the gateway is the source of truth. The sandbox, having no gateway, keeps
 * the old simulation so local development still shows something.
 *
 * Neither state is a balance: IronCore never holds the gym's money.
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
    @Inject(PAYMENTS_PROVIDER) private readonly provider: PaymentsProvider,
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

  /** Reconciles against the gateway, or simulates when there is not one. */
  async runDue(): Promise<number> {
    return this.provider.name === "mock"
      ? this.simulate()
      : this.reconcile();
  }

  /**
   * Reads what the gateway has actually paid out and marks those payments
   * settled. A payout to a subaccount is the gym being paid; a payout with no
   * subaccount is the platform's own share and is none of the gym's business.
   */
  private async reconcile(): Promise<number> {
    const since = new Date(
      Date.now() - RECONCILE_WINDOW_DAYS * 24 * 60 * 60_000,
    );

    const payouts = await this.provider.listSettlements(since);
    let recorded = 0;

    for (const payout of payouts) {
      if (!payout.subaccountCode || payout.references.length === 0) continue;

      // Re-reading the same payout must not record it twice.
      const seen = await this.settlements.exists({
        providerSettlementId: payout.id,
      });
      if (seen) continue;

      const gym = await this.gyms
        .findOne({ "settlementAccount.subaccountCode": payout.subaccountCode })
        .lean();
      if (!gym?.settlementAccount) continue;

      const covered = await this.transactions
        .find({
          gymId: gym._id,
          reference: { $in: payout.references },
          settlementStatus: "pending",
        })
        .select("_id gymNet")
        .lean();

      if (covered.length === 0) continue;

      const settlement = await this.settlements.create({
        gymId: gym._id,
        reference: paymentReference("STL"),
        providerSettlementId: payout.id,
        // What the gateway says it paid, not what we predicted it would.
        amount: payout.amount,
        transactionCount: covered.length,
        status: "paid",
        bankName: gym.settlementAccount.bankName,
        accountLast4: gym.settlementAccount.accountNumber.slice(-4),
        paidAt: payout.settledAt ?? new Date(),
      });

      await this.transactions.updateMany(
        {
          _id: { $in: covered.map((row) => row._id) },
          settlementStatus: "pending",
        },
        {
          $set: {
            settlementStatus: "settled",
            settledAt: settlement.paidAt,
            settlementId: settlement._id,
          },
        },
      );

      recorded += 1;
    }

    if (recorded) this.logger.log(`Recorded ${recorded} gateway payout(s)`);
    return recorded;
  }

  /** Sandbox only: stands in for a gateway that is not there. */
  private async simulate(): Promise<number> {
    const cutoff = new Date(Date.now() - SANDBOX_DELAY_HOURS * 60 * 60_000);

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
