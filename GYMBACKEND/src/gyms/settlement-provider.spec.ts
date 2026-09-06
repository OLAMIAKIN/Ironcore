import type { GymDocument } from "@/gyms/schemas/gym.schema";
import { settlementMatchesProvider } from "@/gyms/gyms.service";

/**
 * The rule behind a live bug: a gym set its payout account up while the mock
 * gateway was running, the deployment switched to Paystack, and every checkout
 * died on "Invalid Subaccount" because a mock handle was sent to the real API.
 */
type GymLike = Pick<GymDocument, "settlementAccount">;

function gymWith(provider?: string): GymLike {
  return {
    settlementAccount: {
      bankCode: "058",
      bankName: "GTBank",
      accountNumber: "0123456789",
      accountName: "Vibez Fitness",
      subaccountCode: "ACCT_something",
      provider,
    },
  } as GymLike;
}

describe("settlementMatchesProvider", () => {
  it("accepts handles issued by the gateway now in use", () => {
    expect(settlementMatchesProvider(gymWith("paystack"), "paystack")).toBe(
      true,
    );
  });

  it("rejects a mock handle once the real gateway is running", () => {
    expect(settlementMatchesProvider(gymWith("mock"), "paystack")).toBe(false);
  });

  it("rejects a real handle if the gateway is switched back", () => {
    expect(settlementMatchesProvider(gymWith("paystack"), "mock")).toBe(false);
  });

  it("treats an account saved before the issuer was recorded as stale", () => {
    // Exactly the accounts that caused the bug: written by an older build that
    // never stamped a provider. Assuming they are fine is what broke checkout.
    expect(settlementMatchesProvider(gymWith(undefined), "paystack")).toBe(
      false,
    );
  });

  it("reports no match when the gym has no payout account at all", () => {
    expect(settlementMatchesProvider({} as GymLike, "paystack")).toBe(false);
  });
});
