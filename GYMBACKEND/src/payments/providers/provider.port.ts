/**
 * The gateway seen from the inside of the app. Controllers and services only
 * ever talk to this interface, so the sandbox and the real Paystack account are
 * interchangeable and nothing above this line knows which one is running.
 */

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
  /** The gym's share, in whole naira, when a split applies. */
  gymNet?: number;
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
  paidAt?: Date;
  failureReason?: string;
};

export type Bank = { name: string; code: string };

export type ResolvedAccount = { accountName: string };

export interface PaymentsProvider {
  readonly name: "mock" | "paystack";

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
   */
  registerSettlementAccount(input: {
    gymName: string;
    bankCode: string;
    accountNumber: string;
    feeRate: number;
  }): Promise<{ subaccountCode?: string; recipientCode?: string }>;

  /** Raw body, because a signature over a re-serialised object proves nothing. */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean;

  parseEvent(payload: unknown): ProviderEvent | null;
}
