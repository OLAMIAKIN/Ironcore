/**
 * Gateway pricing, and the arithmetic for passing it on to the payer.
 *
 * The gym is quoted a price and must receive exactly that price. Two things sit
 * between the payer and the gym — the platform's own fee and the gateway's —
 * so the amount actually charged is the quoted price grossed up to cover both.
 *
 * Everything here is whole naira, because the ledger is. A gateway fee with
 * kobo in it (Paystack charges 1.5%, which on ₦500 is ₦7.50) is always rounded
 * *up*, so the rounding falls on the payer by up to ₦1 rather than on the gym.
 */

export type GatewayFees = {
  /** Proportion of the charge, e.g. 0.015 for 1.5%. */
  percent: number;
  /** Added on top, once the charge reaches `flatAppliesFrom`. */
  flat: number;
  flatAppliesFrom: number;
  /** The gateway never charges more than this on one payment. */
  cap: number;
};

/** A gateway that takes nothing — the sandbox. */
export const NO_FEES: GatewayFees = {
  percent: 0,
  flat: 0,
  flatAppliesFrom: 0,
  cap: 0,
};

/** What the gateway takes out of a payment of `amount`. */
export function gatewayFee(amount: number, fees: GatewayFees): number {
  if (amount <= 0) return 0;

  const raw =
    amount * fees.percent +
    (amount >= fees.flatAppliesFrom ? fees.flat : 0);

  return Math.min(fees.cap, Math.ceil(raw));
}

/**
 * The smallest charge that still leaves `net` behind once the gateway has taken
 * its cut. Returns the charge and the fee it carries.
 *
 * Solved in closed form and then corrected by at most a naira or two, because
 * the fee is a step function — the flat component appears at a threshold and
 * the whole thing stops at a cap, so no single formula covers every band.
 */
export function grossUp(
  net: number,
  fees: GatewayFees,
): { total: number; fee: number } {
  if (net <= 0) return { total: 0, fee: 0 };
  if (fees.percent <= 0 && fees.flat <= 0) return { total: net, fee: 0 };

  // Assume the flat component applies, then check whether it actually does.
  let total = Math.ceil((net + fees.flat) / (1 - fees.percent));
  if (total < fees.flatAppliesFrom) {
    total = Math.ceil(net / (1 - fees.percent));
  }

  // Above the cap the fee stops growing, which is always the cheaper answer.
  const capped = net + fees.cap;
  if (capped < total) total = capped;

  // Nudge up until the gym is whole, then back down to the smallest such charge.
  while (total - gatewayFee(total, fees) < net) total += 1;
  while (total > net && total - 1 - gatewayFee(total - 1, fees) >= net) {
    total -= 1;
  }

  return { total, fee: gatewayFee(total, fees) };
}

export type Charge = {
  /** What the payer is asked for. */
  total: number;
  /** What the gym is owed, and what it was quoted. */
  gymNet: number;
  /** The platform's share, taken by the gateway's split. */
  platformFee: number;
  /** What the gateway is expected to keep. Confirmed against it after payment. */
  gatewayFee: number;
};

/**
 * Prices a payment from the gym's side of it: the gym receives `base`, the
 * platform adds its fee, and the gateway's cut is added on top of both.
 */
export function chargeFor(
  base: number,
  platformFeeRate: number,
  fees: GatewayFees,
): Charge {
  if (!Number.isInteger(base) || base < 0) {
    throw new Error(`base must be a non-negative integer, got ${base}`);
  }

  const platformFee = Math.round(base * platformFeeRate);
  const { total, fee } = grossUp(base + platformFee, fees);

  return { total, gymNet: base, platformFee, gatewayFee: fee };
}
