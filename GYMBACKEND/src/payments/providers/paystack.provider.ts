import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { fromKobo, toKobo } from "@/common/utils/money";
import type {
  Bank,
  Channel,
  InitializeInput,
  InitializeResult,
  PaymentsProvider,
  ProviderEvent,
  ResolvedAccount,
  VerifyResult,
} from "@/payments/providers/provider.port";

type PaystackEnvelope<T> = { status: boolean; message: string; data: T };

/**
 * The real gateway. Selected with PAYMENTS_PROVIDER=paystack and a secret key.
 *
 * Two things this adapter refuses to do: trust an amount from anywhere but
 * Paystack's own verify call, and accept a webhook whose signature does not
 * check out against the raw request body.
 */
@Injectable()
export class PaystackProvider implements PaymentsProvider {
  readonly name = "paystack" as const;
  private readonly logger = new Logger("Paystack");

  constructor(private readonly config: ConfigService) {}

  private get secretKey(): string {
    return this.config.getOrThrow<string>("PAYSTACK_SECRET_KEY");
  }

  private get baseUrl(): string {
    return this.config.getOrThrow<string>("PAYSTACK_BASE_URL");
  }

  private async call<T>(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: init?.method ?? "GET",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      this.logger.error(`${path} did not respond`, String(error));
      throw new ServiceUnavailableException("The payment gateway is unreachable");
    }

    const payload = (await response.json()) as PaystackEnvelope<T>;

    if (!response.ok || !payload.status) {
      // Paystack's message is safe to surface; it is written for humans.
      this.logger.warn(`${path} failed: ${payload.message}`);
      throw new BadGatewayException(payload.message || "Payment gateway error");
    }

    return payload.data;
  }

  async initialize(input: InitializeInput): Promise<InitializeResult> {
    const data = await this.call<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>("/transaction/initialize", {
      method: "POST",
      body: {
        reference: input.reference,
        amount: toKobo(input.amount),
        email: input.email,
        channels: channelsFor(input.channel),
        callback_url: this.config.getOrThrow<string>("PAYMENT_CALLBACK_URL"),
        // The gym's share is split by Paystack itself, so the platform never
        // holds the gym's money.
        subaccount: input.subaccountCode,
        transaction_charge:
          input.subaccountCode && input.gymNet !== undefined
            ? toKobo(input.amount - input.gymNet)
            : undefined,
        bearer: input.subaccountCode ? "account" : undefined,
        metadata: input.metadata ?? {},
      },
    });

    return {
      providerReference: data.reference,
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      sandbox: false,
    };
  }

  async verify(reference: string): Promise<VerifyResult> {
    const data = await this.call<{
      status: string;
      amount: number;
      channel?: string;
      paid_at?: string;
      reference: string;
      gateway_response?: string;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);

    return {
      status:
        data.status === "success"
          ? "success"
          : data.status === "failed" || data.status === "reversed"
            ? "failed"
            : "pending",
      amount: fromKobo(data.amount),
      channel: toChannel(data.channel),
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
      providerReference: data.reference,
      failureReason:
        data.status === "success" ? undefined : data.gateway_response,
    };
  }

  async listBanks(): Promise<Bank[]> {
    const data = await this.call<{ name: string; code: string }[]>(
      "/bank?country=nigeria&perPage=100",
    );
    return data.map((bank) => ({ name: bank.name, code: bank.code }));
  }

  async resolveAccount(input: {
    bankCode: string;
    accountNumber: string;
  }): Promise<ResolvedAccount> {
    const data = await this.call<{ account_name: string }>(
      `/bank/resolve?account_number=${encodeURIComponent(input.accountNumber)}&bank_code=${encodeURIComponent(input.bankCode)}`,
    );
    return { accountName: data.account_name };
  }

  async registerSettlementAccount(input: {
    gymName: string;
    bankCode: string;
    accountNumber: string;
    feeRate: number;
  }): Promise<{ subaccountCode?: string; recipientCode?: string }> {
    const subaccount = await this.call<{ subaccount_code: string }>(
      "/subaccount",
      {
        method: "POST",
        body: {
          business_name: input.gymName,
          bank_code: input.bankCode,
          account_number: input.accountNumber,
          percentage_charge: Number((input.feeRate * 100).toFixed(2)),
        },
      },
    );

    const recipient = await this.call<{ recipient_code: string }>(
      "/transferrecipient",
      {
        method: "POST",
        body: {
          type: "nuban",
          name: input.gymName,
          bank_code: input.bankCode,
          account_number: input.accountNumber,
          currency: "NGN",
        },
      },
    );

    return {
      subaccountCode: subaccount.subaccount_code,
      recipientCode: recipient.recipient_code,
    };
  }

  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;

    const expected = createHmac("sha512", this.secretKey)
      .update(rawBody)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseEvent(payload: unknown): ProviderEvent | null {
    if (typeof payload !== "object" || payload === null) return null;

    const event = payload as {
      event?: string;
      data?: {
        id?: number;
        reference?: string;
        amount?: number;
        channel?: string;
        paid_at?: string;
        gateway_response?: string;
      };
    };

    const reference = event.data?.reference;
    if (!reference) return null;

    if (event.event === "charge.success") {
      return {
        id: `paystack:${event.data?.id ?? reference}`,
        type: "charge.success",
        reference,
        providerReference: reference,
        amount: event.data?.amount ? fromKobo(event.data.amount) : undefined,
        channel: toChannel(event.data?.channel),
        paidAt: event.data?.paid_at ? new Date(event.data.paid_at) : new Date(),
      };
    }

    if (event.event === "charge.failed") {
      return {
        id: `paystack:${event.data?.id ?? reference}`,
        type: "charge.failed",
        reference,
        providerReference: reference,
        failureReason: event.data?.gateway_response ?? "The payment failed",
      };
    }

    return null;
  }
}

/** Our three channels, expressed the way Paystack names them. */
function channelsFor(channel: Channel): string[] {
  switch (channel) {
    case "card":
      return ["card"];
    case "transfer":
      return ["bank_transfer"];
    case "opay":
      // Opay wallets reach Paystack over USSD/transfer rails.
      return ["ussd", "bank_transfer"];
  }
}

function toChannel(value: string | undefined): Channel | undefined {
  if (value === "card") return "card";
  if (value === "bank_transfer" || value === "dedicated_nuban") return "transfer";
  if (value === "ussd" || value === "mobile_money") return "opay";
  return undefined;
}
