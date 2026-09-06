import { fromKobo, splitOf, toKobo } from "./money";

describe("splitOf", () => {
  it("keeps the fee and the net adding up to the gross", () => {
    for (const gross of [0, 1, 999, 15000, 40000, 140000, 123457]) {
      const split = splitOf(gross, 0.05);
      expect(split.platformFee + split.gymNet).toBe(gross);
    }
  });

  it("rounds the fee down so it never exceeds the payment", () => {
    expect(splitOf(999, 0.05)).toEqual({
      gross: 999,
      platformFee: 49,
      gymNet: 950,
    });
  });

  it("handles a zero fee rate", () => {
    expect(splitOf(15000, 0)).toEqual({
      gross: 15000,
      platformFee: 0,
      gymNet: 15000,
    });
  });

  it("rejects a negative or fractional gross", () => {
    expect(() => splitOf(-1, 0.05)).toThrow();
    expect(() => splitOf(10.5, 0.05)).toThrow();
  });
});

describe("kobo conversion", () => {
  it("round-trips whole naira", () => {
    expect(fromKobo(toKobo(15000))).toBe(15000);
  });
});
