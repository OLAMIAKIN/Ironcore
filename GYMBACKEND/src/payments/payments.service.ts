import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { splitOf } from "@/common/utils/money";
import { paymentReference } from "@/common/utils/reference";
import type { AuthUser } from "@/common/types";
import { GymsService } from "@/gyms/gyms.service";
import { listingPlanById } from "@/gyms/listing-plans";
import { PlansService } from "@/plans/plans.service";
import { SubscriptionsService } from "@/subscriptions/subscriptions.service";
import { DayPassesService } from "@/daypasses/daypasses.service";
import {
  PAYMENTS_PROVIDER,
  type PaymentsProvider,
  type ProviderEvent,
} from "@/payments/providers/provider.port";
import {
  Transaction,
  type TransactionDocument,
} from "@/transactions/schemas/transaction.schema";
import {
  WebhookEvent,
  type WebhookEventDocument,
} from "@/payments/schemas/webhook-event.schema";
import type {
  InitializePaymentDto,
  SimulatePaymentDto,
} from "@/payments/dto/payment.dto";
import { User, type UserDocument } from "@/users/schemas/user.schema";

export type CheckoutSession = {
  reference: string;
  amount: number;
  currency: string;
  channel: "card" | "opay" | "transfer";
  purpose: Transaction["purpose"];
  status: Transaction["status"];
  sandbox: boolean;
  authorizationUrl?: string;
  transfer?: { bankName: string; accountNumber: string; expiresAt: string };
  /** Only ever shown to the person paying, never on an owner endpoint. */
  split?: { gymNet: number; platformFee: number };
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger("Payments");

  constructor(
    @InjectModel(Transaction.name)
    private readonly transactions: Model<TransactionDocument>,
    @InjectModel(WebhookEvent.name)
    private readonly events: Model<WebhookEventDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @Inject(PAYMENTS_PROVIDER) private readonly provider: PaymentsProvider,
    private readonly config: ConfigService,
    private readonly gyms: GymsService,
    private readonly plans: PlansService,
    private readonly subscriptions: SubscriptionsService,
    private readonly dayPasses: DayPassesService,
  ) {}

  private get feeRate(): number {
    return this.config.getOrThrow<number>("PLATFORM_FEE_RATE");
  }

  /**
   * Opens a checkout. The amount is always read from the database — a client
   * that posts its own price is ignored, which is the single most important
   * rule in this file.
   */
  async initialize(
    user: AuthUser,
    dto: InitializePaymentDto,
  ): Promise<CheckoutSession> {
    const payer = await this.users.findById(user.id).lean();
    if (!payer) throw new ForbiddenException("Account is unavailable");

    const reference = paymentReference(prefixFor(dto.purpose));
    const draft = await this.buildDraft(user, dto, reference);

    const created = await this.transactions.create({
      ...draft,
      reference,
      provider: this.provider.name,
      channel: dto.channel,
      status: "pending",
      payerId: new Types.ObjectId(user.id),
      payerName: payer.name,
    });

    const gym = draft.gymId
      ? await this.gyms.requireGym(draft.gymId.toString())
      : null;

    const initialized = await this.provider.initialize({
      reference,
      amount: draft.gross,
      email: payer.email ?? `${payer.phone}@members.ironcore.app`,
      channel: dto.channel,
      // Listing payments are owed to the platform, so they are never split.
      subaccountCode:
        draft.purpose === "listing"
          ? undefined
          : gym?.settlementAccount?.subaccountCode,
      gymNet: draft.gymNet,
      metadata: {
        purpose: draft.purpose,
        gymId: draft.gymId?.toString() ?? "",
      },
    });

    created.providerReference = initialized.providerReference;
    if (initialized.transfer) {
      created.metadata = {
        ...created.metadata,
        transferBank: initialized.transfer.bankName,
        transferAccount: initialized.transfer.accountNumber,
        transferExpiresAt: initialized.transfer.expiresAt,
      };
    }
    await created.save();

    return {
      reference,
      amount: draft.gross,
      currency: "NGN",
      channel: dto.channel,
      purpose: draft.purpose,
      status: "pending",
      sandbox: initialized.sandbox,
      authorizationUrl: initialized.authorizationUrl,
      transfer: initialized.transfer,
      split:
        draft.purpose === "listing"
          ? undefined
          : { gymNet: draft.gymNet, platformFee: draft.platformFee },
    };
  }

  /** Works out what is being bought and what it costs. */
  private async buildDraft(
    user: AuthUser,
    dto: InitializePaymentDto,
    reference: string,
  ): Promise<{
    purpose: Transaction["purpose"];
    gymId?: Types.ObjectId;
    gross: number;
    platformFee: number;
    gymNet: number;
    settlementStatus: Transaction["settlementStatus"];
    metadata: Record<string, string>;
  }> {
    if (dto.purpose === "listing") {
      if (user.role !== "owner" || !user.gymId) {
        throw new ForbiddenException("Only a gym owner can pay for a listing");
      }

      const plan = listingPlanById(dto.listingPlanId ?? "");
      if (!plan) throw new BadRequestException("Choose a listing plan");

      const gym = await this.gyms.requireGym(user.gymId);
      if (!gym.settlementAccount) {
        throw new BadRequestException(
          "Add the account your members' payments should be settled to first",
        );
      }

      return {
        purpose: "listing",
        gymId: gym._id,
        gross: plan.price,
        platformFee: plan.price,
        gymNet: 0,
        settlementStatus: "not_applicable",
        metadata: {
          listingPlanId: plan.id,
          listingPlanName: plan.name,
          durationDays: String(plan.durationDays),
          reference,
        },
      };
    }

    if (!dto.gymId) throw new BadRequestException("Choose a gym");
    const gym = await this.gyms.requireGym(dto.gymId);
    this.gyms.assertCanTakePayments(gym);

    if (dto.purpose === "day_pass") {
      const split = splitOf(gym.dayPassPrice, this.feeRate);
      return {
        purpose: "day_pass",
        gymId: gym._id,
        ...split,
        settlementStatus: "pending",
        metadata: { guestName: dto.guestName ?? "" },
      };
    }

    if (user.role !== "member") {
      throw new ForbiddenException("Only members can buy a membership plan");
    }

    if (!dto.planId) throw new BadRequestException("Choose a plan");
    const plan = await this.plans.requireForGym(dto.planId, gym._id);
    const split = splitOf(plan.price, this.feeRate);

    return {
      purpose: "subscription",
      gymId: gym._id,
      ...split,
      settlementStatus: "pending",
      metadata: {
        planId: plan._id.toString(),
        planName: plan.name,
        durationDays: String(plan.durationDays),
      },
    };
  }

  /**
   * Sandbox only. Settles or declines a payment the caller started, so the
   * frontend can walk both paths without a gateway.
   */
  async simulate(
    user: AuthUser,
    reference: string,
    dto: SimulatePaymentDto,
  ): Promise<CheckoutSession> {
    if (this.provider.name !== "mock") {
      throw new ForbiddenException(
        "This deployment uses a real gateway — payments cannot be simulated",
      );
    }

    const transaction = await this.requireOwnTransaction(reference, user);

    if (dto.outcome === "failed") {
      await this.markFailed(transaction.reference, "The payment was declined");
    } else {
      await this.applyEvent({
        id: `mock:${transaction.reference}`,
        type: "charge.success",
        reference: transaction.reference,
        providerReference: transaction.providerReference,
        channel: transaction.channel,
        amount: transaction.gross,
        paidAt: new Date(),
      });
    }

    return this.status(user, reference);
  }

  /** Polled by the checkout screen while a payment is in flight. */
  async status(user: AuthUser, reference: string): Promise<CheckoutSession> {
    let transaction = await this.requireOwnTransaction(reference, user);

    // With a real gateway the webhook may still be in flight, so ask directly.
    if (transaction.status === "pending" && this.provider.name === "paystack") {
      const verified = await this.provider.verify(reference);

      if (verified.status === "success") {
        await this.applyEvent({
          id: `verify:${reference}`,
          type: "charge.success",
          reference,
          providerReference: verified.providerReference,
          channel: verified.channel,
          amount: verified.amount,
          paidAt: verified.paidAt ?? new Date(),
        });
        transaction = await this.requireOwnTransaction(reference, user);
      } else if (verified.status === "failed") {
        await this.markFailed(
          reference,
          verified.failureReason ?? "The payment failed",
        );
        transaction = await this.requireOwnTransaction(reference, user);
      }
    }

    return {
      reference: transaction.reference,
      amount: transaction.gross,
      currency: transaction.currency,
      channel: transaction.channel,
      purpose: transaction.purpose,
      status: transaction.status,
      sandbox: this.provider.name === "mock",
      transfer: transaction.metadata.transferAccount
        ? {
            bankName: transaction.metadata.transferBank ?? "",
            accountNumber: transaction.metadata.transferAccount,
            expiresAt: transaction.metadata.transferExpiresAt ?? "",
          }
        : undefined,
      split:
        transaction.purpose === "listing"
          ? undefined
          : {
              gymNet: transaction.gymNet,
              platformFee: transaction.platformFee,
            },
    };
  }

  /** Entry point for gateway webhooks, after the signature has been checked. */
  async handleWebhook(rawBody: Buffer, signature?: string): Promise<void> {
    if (!this.provider.verifySignature(rawBody, signature)) {
      throw new ForbiddenException("Invalid webhook signature");
    }

    const payload: unknown = JSON.parse(rawBody.toString("utf8"));
    const event = this.provider.parseEvent(payload);
    if (!event) return;

    try {
      await this.events.create({
        eventId: event.id,
        provider: this.provider.name,
        type: event.type,
        reference: event.reference,
      });
    } catch {
      // Duplicate delivery — already handled.
      this.logger.debug(`Ignored repeat webhook ${event.id}`);
      return;
    }

    if (event.type === "charge.success") {
      await this.applyEvent(event);
    } else {
      await this.markFailed(
        event.reference,
        event.failureReason ?? "The payment failed",
      );
    }
  }

  /**
   * The one place a payment becomes real. The status filter makes it
   * idempotent: a retried webhook finds nothing to update and does nothing.
   */
  private async applyEvent(event: ProviderEvent): Promise<void> {
    const pending = await this.transactions.findOne({
      reference: event.reference,
    });
    if (!pending) {
      this.logger.warn(`Event for unknown reference ${event.reference}`);
      return;
    }

    // A gateway that reports a different amount than we asked for is a red
    // flag; record it and refuse to fulfil.
    if (event.amount !== undefined && event.amount !== pending.gross) {
      await this.markFailed(
        event.reference,
        "The amount paid did not match the amount due",
      );
      this.logger.error(
        `Amount mismatch on ${event.reference}: expected ${pending.gross}, saw ${event.amount}`,
      );
      return;
    }

    const claimed = await this.transactions.findOneAndUpdate(
      { reference: event.reference, status: "pending" },
      {
        $set: {
          status: "success",
          paidAt: event.paidAt ?? new Date(),
          channel: event.channel ?? pending.channel,
          providerReference:
            event.providerReference ?? pending.providerReference,
          settlementStatus:
            pending.purpose === "listing" ? "not_applicable" : "pending",
        },
      },
      { new: true },
    );

    if (!claimed) return; // Already settled by an earlier delivery.

    await this.fulfil(claimed);
  }

  /** What the money bought. Runs once per transaction. */
  private async fulfil(transaction: TransactionDocument): Promise<void> {
    if (transaction.purpose === "subscription") {
      const subscription = await this.subscriptions.applyRenewal({
        memberId: transaction.payerId!,
        gymId: transaction.gymId!,
        plan: {
          planId: new Types.ObjectId(transaction.metadata.planId),
          name: transaction.metadata.planName ?? "Membership",
          price: transaction.gross,
          durationDays: Number(transaction.metadata.durationDays ?? 30),
        },
      });

      transaction.metadata = {
        ...transaction.metadata,
        subscriptionId: subscription._id.toString(),
      };
      await transaction.save();
      return;
    }

    if (transaction.purpose === "day_pass") {
      const pass = await this.dayPasses.issue({
        gymId: transaction.gymId!,
        buyerId: transaction.payerId,
        buyerName:
          transaction.metadata.guestName || transaction.payerName || "Guest",
        transactionId: transaction._id,
      });

      transaction.metadata = {
        ...transaction.metadata,
        dayPassId: pass._id.toString(),
        dayPassToken: pass.token,
      };
      await transaction.save();
      return;
    }

    await this.gyms.activateListing(transaction.gymId!, {
      planId: transaction.metadata.listingPlanId ?? "starter",
      planName: transaction.metadata.listingPlanName ?? "Starter",
      price: transaction.gross,
      durationDays: Number(transaction.metadata.durationDays ?? 30),
      reference: transaction.reference,
    });
  }

  private async markFailed(reference: string, reason: string): Promise<void> {
    await this.transactions.updateOne(
      { reference, status: "pending" },
      { $set: { status: "failed", failureReason: reason } },
    );
  }

  /** A payer may only ever look at their own payments. */
  private async requireOwnTransaction(
    reference: string,
    user: AuthUser,
  ): Promise<TransactionDocument> {
    const transaction = await this.transactions.findOne({ reference });
    if (!transaction) throw new NotFoundException("Payment not found");

    const isPayer = transaction.payerId?.toString() === user.id;
    const isTheirGym =
      user.role === "owner" &&
      !!user.gymId &&
      transaction.gymId?.toString() === user.gymId;

    if (!isPayer && !isTheirGym) {
      throw new NotFoundException("Payment not found");
    }
    return transaction;
  }
}

function prefixFor(purpose: InitializePaymentDto["purpose"]): string {
  if (purpose === "listing") return "LST";
  if (purpose === "day_pass") return "PASS";
  return "SUB";
}
