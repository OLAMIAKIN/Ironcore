import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { virtualAccountNumber } from "@/common/utils/reference";
import type {
  Bank,
  InitializeInput,
  InitializeResult,
  PaymentsProvider,
  ProviderEvent,
  ResolvedAccount,
  VerifyResult,
} from "@/payments/providers/provider.port";

/**
 * The sandbox gateway. It authorises nothing and moves no money: a payment sits
 * pending until the client calls the simulate endpoint, which is how the whole
 * app can be clicked through without keys or a public webhook URL.
 *
 * Everything it returns is shaped like the real provider's response, so the
 * Paystack adapter can be swapped in without touching a caller.
 */

const BANKS: Bank[] = [
  { name: "Access Bank", code: "044" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "Opay Digital Services", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Sterling Bank", code: "232" },
  { name: "United Bank for Africa", code: "033" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

/** Stand-in names, stable per account number so a demo looks consistent. */
const FIRST_NAMES = [
  "ADA",
  "CHIDINMA",
  "EMEKA",
  "FEMI",
  "HALIMA",
  "IBRAHIM",
  "NGOZI",
  "SEGUN",
  "TUNDE",
  "ZAINAB",
];
const LAST_NAMES = [
  "ADEYEMI",
  "BELLO",
  "DANJUMA",
  "ETIM",
  "FASHOLA",
  "NNAMDI",
  "OKAFOR",
  "OGUNLEYE",
  "USMAN",
  "YUSUF",
];

@Injectable()
export class MockPaymentsProvider implements PaymentsProvider {
  readonly name = "mock" as const;
  private readonly logger = new Logger("MockPayments");

  async initialize(input: InitializeInput): Promise<InitializeResult> {
    this.logger.debug(
      `sandbox charge ${input.reference} for ${input.amount} via ${input.channel}`,
    );

    return {
      providerReference: `mock_${randomUUID()}`,
      sandbox: true,
      transfer:
        input.channel === "transfer"
          ? {
              bankName: "Wema Bank",
              accountNumber: virtualAccountNumber(),
              expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
            }
          : undefined,
    };
  }

  /**
   * The sandbox has no opinion of its own: the ledger is the source of truth,
   * so the caller keeps whatever status it already recorded.
   */
  async verify(_reference: string): Promise<VerifyResult> {
    return { status: "pending" };
  }

  async listBanks(): Promise<Bank[]> {
    return BANKS;
  }

  async resolveAccount(input: {
    bankCode: string;
    accountNumber: string;
  }): Promise<ResolvedAccount> {
    const digest = createHash("sha256").update(input.accountNumber).digest();
    const first = FIRST_NAMES[digest[0]! % FIRST_NAMES.length]!;
    const last = LAST_NAMES[digest[1]! % LAST_NAMES.length]!;
    return { accountName: `${first} ${last}` };
  }

  async registerSettlementAccount(): Promise<{
    subaccountCode?: string;
    recipientCode?: string;
  }> {
    return {
      subaccountCode: `ACCT_mock_${randomUUID().slice(0, 8)}`,
      recipientCode: `RCP_mock_${randomUUID().slice(0, 8)}`,
    };
  }

  /** Nothing external posts to the sandbox, so no signature can be trusted. */
  verifySignature(): boolean {
    return false;
  }

  parseEvent(): ProviderEvent | null {
    return null;
  }
}
