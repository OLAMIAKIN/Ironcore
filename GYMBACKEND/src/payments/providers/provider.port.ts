/**
 * The gateway seen from the inside of the app. Controllers and services only
 * ever talk to this interface, so the sandbox and the real Paystack account are
 * interchangeable and nothing above this line knows which one is running.
 */

import type { GatewayFees } from "@/payments/fees";

export const PAYMENTS_PROVIDER = Symbol("PAYMENTS_PROVIDER");

export type Channel = "card" | "opay" | "transfer";

export type InitializeInput = {
  reference: string;
  /** Whole naira. Converted at the edge for providers that talk in kobo. */
  amount: number;
  email: string;
  channel: Channel;
  /** Set when a gym's share should be split off by the gateway itself. */
  subaccountCode?: string;
  /**
   * The platform's cut in whole naira, handed to the gateway as a flat split
   * charge. Everything else the payer hands over, less the gateway's own fee,
   * goes to the subaccount — which is how the gym ends up with exactly the
   * price it quoted.
   */
  platformFee?: number;
  metadata?: Record<string, string>;
};

export type TransferInstructions = {
  bankName: string;
  accountNumber: string;
  expiresAt: string;
};

export type InitializeResult = {
  providerReference: string;
  /** Present for real checkouts; the sandbox has nowhere to send anyone. */
  authorizationUrl?: string;
  accessCode?: string;
  /** True when this payment can be settled by the simulate endpoint. */
  sandbox: boolean;
  transfer?: TransferInstructions;
};

export type VerifyResult = {
  status: "pending" | "success" | "failed";
  channel?: Channel;
  paidAt?: Date;
  providerReference?: string;
  /** Whole naira, as the gateway saw it — checked against our own record. */
  amount?: number;
  /** What the gateway actually kept, so the estimate can be corrected. */
  gatewayFee?: number;
  failureReason?: string;
};

export type ProviderEvent = {
  /** Deduplicates retries; a provider that sends none gets a synthetic id. */
  id: string;
  type: "charge.success" | "charge.failed";
  reference: string;
  providerReference?: string;
  channel?: Channel;
  amount?: number;
  /** What the gateway actually kept, when it says so. */
  gatewayFee?: number;
  paidAt?: Date;
  failureReason?: string;
};

export type Bank = { name: string; code: string };

/** One payout the gateway has actually made, and what it covered. */
export type ProviderSettlement = {
  /** The gateway's own id for the payout. */
  id: string;
  /** Whole naira actually paid out. */
  amount: number;
  settledAt?: Date;
  /** Which subaccount it went to, absent for the platform's own payout. */
  subaccountCode?: string;
  /** Our references for the payments it covered. */
  references: string[];
};

export type ResolvedAccount = { accountName: string };

export interface PaymentsProvider {
  readonly name: "mock" | "paystack";

  /**
   * The gateway's own pricing. Payments are grossed up by this so the gym
   * receives the price it quoted rather than the price minus a cut.
   */
  readonly fees: GatewayFees;

  initialize(input: InitializeInput): Promise<InitializeResult>;

  verify(reference: string): Promise<VerifyResult>;

  listBanks(): Promise<Bank[]>;

  resolveAccount(input: {
    bankCode: string;
    accountNumber: string;
  }): Promise<ResolvedAccount>;

  /**
   * Registers the gym for payouts. The sandbox returns made-up handles; the
   * real adapter creates a Paystack subaccount and transfer recipient.
   *
   * Both names are needed because they label different things: `gymName` is the
   * business the subaccount belongs to, and `accountName` is whoever actually
   * holds the bank account. They are often not the same person.
   */
  registerSettlementAccount(input: {
    gymName: string;
    /** The account holder, as resolved from the bank — never typed by hand. */
    accountName: string;
    bankCode: string;
    accountNumber: string;
    feeRate: number;
  }): Promise<{ subaccountCode?: string; recipientCode?: string }>;

  /**
   * Payouts the gateway has actually made since `since`.
   *
   * This is the difference between "we think it has settled" and "it has
   * settled": the app reports settlement from what the gateway says it paid,
   * not from a timer.
   */
  listSettlements(since: Date): Promise<ProviderSettlement[]>;

  /** Raw body, because a signature over a re-serialised object proves nothing. */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean;

  parseEvent(payload: unknown): ProviderEvent | null;
}
