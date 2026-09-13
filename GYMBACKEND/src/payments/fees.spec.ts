import { chargeFor, gatewayFee, grossUp, NO_FEES, type GatewayFees } from "./fees";

/** Paystack's published Nigerian pricing, and the defaults the app ships with. */
const PAYSTACK: GatewayFees = {
  percent: 0.015,
  flat: 100,
  flatAppliesFrom: 2500,
  cap: 2000,
};

describe("gatewayFee", () => {
  it("matches the fee Paystack actually charged on a live ₦500 transfer", () => {
    // Observed on the dashboard: ₦500 -> ₦7.50. Rounded up to the naira here.
    expect(gatewayFee(500, PAYSTACK)).toBe(8);
  });

  it("leaves the flat component off below the threshold", () => {
    expect(gatewayFee(2499, PAYSTACK)).toBe(Math.ceil(2499 * 0.015));
  });

  it("adds the flat component at the threshold", () => {
    expect(gatewayFee(2500, PAYSTACK)).toBe(Math.ceil(2500 * 0.015) + 100);
  });

  it("never exceeds the cap", () => {
    for (const amount of [140_000, 500_000, 10_000_000]) {
      expect(gatewayFee(amount, PAYSTACK)).toBeLessThanOrEqual(PAYSTACK.cap);
    }
    expect(gatewayFee(10_000_000, PAYSTACK)).toBe(2000);
  });

  it("takes nothing when the gateway charges nothing", () => {
    expect(gatewayFee(15_000, NO_FEES)).toBe(0);
  });
});

describe("grossUp", () => {
  const NETS = [
    1, 100, 499, 500, 501, 2400, 2499, 2500, 2501, 15_000, 40_000, 140_000,
    1_000_000,
  ];

  it("always leaves the net whole", () => {
    for (const net of NETS) {
      const { total, fee } = grossUp(net, PAYSTACK);
      expect(total - fee).toBeGreaterThanOrEqual(net);
    }
  });

  it("charges the smallest amount that does so", () => {
    for (const net of NETS) {
      const { total } = grossUp(net, PAYSTACK);
      // One naira less must leave the gym short, or we are overcharging.
      expect(total - 1 - gatewayFee(total - 1, PAYSTACK)).toBeLessThan(net);
    }
  });

  it("never overshoots the net by more than a naira", () => {
    for (const net of NETS) {
      const { total, fee } = grossUp(net, PAYSTACK);
      expect(total - fee - net).toBeLessThanOrEqual(1);
    }
  });

  it("charges the net itself when the gateway is free", () => {
    expect(grossUp(15_000, NO_FEES)).toEqual({ total: 15_000, fee: 0 });
  });

  it("handles the capped band, where the fee stops growing", () => {
    const { total, fee } = grossUp(1_000_000, PAYSTACK);
    expect(fee).toBe(2000);
    expect(total).toBe(1_002_000);
  });
});

describe("chargeFor", () => {
  it("leaves the gym exactly what it quoted", () => {
    for (const base of [500, 15_000, 40_000, 140_000]) {
      for (const rate of [0, 0.005, 0.05]) {
        const charge = chargeFor(base, rate, PAYSTACK);
        expect(charge.gymNet).toBe(base);
        // What the payer hands over covers all three parts.
        expect(charge.total - charge.gatewayFee - charge.platformFee)
          .toBeGreaterThanOrEqual(base);
      }
    }
  });

  it("prices the live ₦500 day pass at the deployed 0.5% rate", () => {
    const charge = chargeFor(500, 0.005, PAYSTACK);
    // ₦500 to the gym, ₦3 platform (0.5% rounded), ~₦8 to Paystack.
    expect(charge.gymNet).toBe(500);
    expect(charge.platformFee).toBe(3);
    expect(charge.total).toBe(511);
    expect(charge.gatewayFee).toBe(8);
  });

  it("prices a ₦15,000 plan at 5%", () => {
    const charge = chargeFor(15_000, 0.05, PAYSTACK);
    expect(charge.gymNet).toBe(15_000);
    expect(charge.platformFee).toBe(750);
    expect(charge.total - charge.gatewayFee - charge.platformFee).toBe(15_000);
  });

  it("charges only the price itself when nothing takes a cut", () => {
    expect(chargeFor(15_000, 0, NO_FEES)).toEqual({
      total: 15_000,
      gymNet: 15_000,
      platformFee: 0,
      gatewayFee: 0,
    });
  });

  it("refuses a nonsense price", () => {
    expect(() => chargeFor(-1, 0.05, PAYSTACK)).toThrow();
    expect(() => chargeFor(1.5, 0.05, PAYSTACK)).toThrow();
  });
});
