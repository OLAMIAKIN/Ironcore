import { PaystackProvider } from "./paystack.provider";

/**
 * What actually reaches Paystack, without reaching Paystack.
 *
 * The two things worth pinning down are the ones that decide how much money the
 * gym ends up with: that the fee model is read from configuration rather than
 * guessed, and that the split charge sent per transaction is the platform's cut
 * alone — the payer has already been charged the gateway's fee on top.
 */

const CONFIG: Record<string, unknown> = {
  PAYSTACK_SECRET_KEY: "sk_test_not_a_real_key",
  PAYSTACK_BASE_URL: "https://api.paystack.co",
  PAYMENT_CALLBACK_URL: "https://example.test/payments/callback",
  PAYSTACK_FEE_PERCENT: 0.015,
  PAYSTACK_FEE_FLAT: 100,
  PAYSTACK_FEE_FLAT_FROM: 2500,
  PAYSTACK_FEE_CAP: 2000,
};

const config = {
  getOrThrow: <T>(key: string): T => {
    if (!(key in CONFIG)) throw new Error(`missing ${key}`);
    return CONFIG[key] as T;
  },
} as never;

function provider() {
  return new PaystackProvider(config);
}

/** Captures the body of the one call the provider makes. */
function captureFetch(payload: unknown) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];

  global.fetch = (async (url: URL | string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : {},
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: true, message: "ok", data: payload }),
    };
  }) as typeof fetch;

  return calls;
}

describe("PaystackProvider fees", () => {
  it("reads the fee model from configuration", () => {
    expect(provider().fees).toEqual({
      percent: 0.015,
      flat: 100,
      flatAppliesFrom: 2500,
      cap: 2000,
    });
  });
});

describe("PaystackProvider initialize", () => {
  it("sends the platform's cut as the split charge, not the whole margin", async () => {
    const calls = captureFetch({
      authorization_url: "https://checkout.test/x",
      access_code: "ac",
      reference: "PASS-1",
    });

    // A ₦500 day pass at 5%, grossed up: payer 533, platform 25, gateway 8.
    await provider().initialize({
      reference: "PASS-1",
      amount: 533,
      email: "member@example.test",
      channel: "card",
      subaccountCode: "ACCT_gym",
      platformFee: 25,
    });

    const body = calls[0]!.body;
    expect(body.amount).toBe(53_300);
    expect(body.subaccount).toBe("ACCT_gym");
    // ₦25 in kobo — the gateway takes its own fee separately.
    expect(body.transaction_charge).toBe(2_500);
  });

  it("sends no split at all when there is no subaccount", async () => {
    const calls = captureFetch({
      authorization_url: "https://checkout.test/x",
      access_code: "ac",
      reference: "LST-1",
    });

    await provider().initialize({
      reference: "LST-1",
      amount: 35_533,
      email: "owner@example.test",
      channel: "card",
    });

    const body = calls[0]!.body;
    expect(body.subaccount).toBeUndefined();
    expect(body.transaction_charge).toBeUndefined();
    expect(body.bearer).toBeUndefined();
  });
});

describe("PaystackProvider verify", () => {
  it("reports the fee Paystack actually charged, in naira", async () => {
    captureFetch({
      status: "success",
      amount: 53_300,
      fees: 800,
      reference: "PASS-1",
      paid_at: "2026-09-08T00:30:00.000Z",
      channel: "bank_transfer",
    });

    const result = await provider().verify("PASS-1");

    expect(result.status).toBe("success");
    expect(result.amount).toBe(533);
    expect(result.gatewayFee).toBe(8);
    expect(result.channel).toBe("transfer");
  });
});

describe("PaystackProvider registerSettlementAccount", () => {
  /**
   * The two names label different things and had been collapsed into one: the
   * gym's name was sent as the transfer recipient, so Paystack was told the
   * account belonged to "Tope Gym — 3,Akinwa Close" rather than to the person
   * the bank actually named.
   */
  it("names the recipient after the account holder, not the gym", async () => {
    const calls = captureFetch({
      subaccount_code: "ACCT_gym",
      recipient_code: "RCP_holder",
    });

    const handles = await provider().registerSettlementAccount({
      gymName: "Tope Gym — 3,Akinwa Close",
      accountName: "ADA YUSUF",
      bankCode: "999992",
      accountNumber: "7018489574",
      feeRate: 0.05,
    });

    const subaccount = calls.find((call) => call.url.endsWith("/subaccount"));
    const recipient = calls.find((call) =>
      call.url.endsWith("/transferrecipient"),
    );

    // The subaccount stays labelled by gym, so it is identifiable in the
    // dashboard among every other gym's.
    expect(subaccount?.body.business_name).toBe("Tope Gym — 3,Akinwa Close");

    // The recipient is a person being paid, so it carries the resolved holder.
    expect(recipient?.body.name).toBe("ADA YUSUF");
    expect(recipient?.body.account_number).toBe("7018489574");
    expect(recipient?.body.type).toBe("nuban");

    expect(handles).toEqual({
      subaccountCode: "ACCT_gym",
      recipientCode: "RCP_holder",
    });
  });

  it("never sends the gym name as a recipient", async () => {
    const calls = captureFetch({
      subaccount_code: "ACCT_gym",
      recipient_code: "RCP_holder",
    });

    await provider().registerSettlementAccount({
      gymName: "Olami Gym — Obawole",
      accountName: "BOLA ADEYEMI",
      bankCode: "999992",
      accountNumber: "7082240158",
      feeRate: 0.005,
    });

    const recipient = calls.find((call) =>
      call.url.endsWith("/transferrecipient"),
    );
    expect(recipient?.body.name).not.toContain("Gym");
  });
});
