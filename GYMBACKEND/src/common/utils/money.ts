/**
 * Money is held in whole naira as integers. The split is computed in one place
 * so the ledger, the receipts and the reports can never disagree.
 */
export type Split = {
  gross: number;
  platformFee: number;
  gymNet: number;
};

export function splitOf(gross: number, feeRate: number): Split {
  if (!Number.isInteger(gross) || gross < 0) {
    throw new Error(`gross must be a non-negative integer, got ${gross}`);
  }

  // Rounded down, so the fee can never exceed the payment through rounding.
  const platformFee = Math.min(gross, Math.floor(gross * feeRate));
  return { gross, platformFee, gymNet: gross - platformFee };
}

/** Paystack talks in kobo; the ledger talks in naira. */
export function toKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function fromKobo(kobo: number): number {
  return Math.round(kobo / 100);
}
