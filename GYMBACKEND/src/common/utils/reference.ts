import { randomBytes, randomInt } from "node:crypto";

/**
 * Payment references are generated server-side only. They are unguessable so a
 * reference cannot be used to enumerate other people's transactions.
 */
export function paymentReference(prefix: string): string {
  return `${prefix.toUpperCase()}-${randomBytes(8).toString("hex").toUpperCase()}`;
}

/** Member check-in codes and guest tokens. */
export function accessToken(prefix: string): string {
  return `${prefix.toUpperCase()}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/**
 * Alphabet for a password that gets read aloud across a front desk: no O/0,
 * no I/1/l, and no U — which is easy to mishear as "you".
 */
const READABLE = "ABCDEFGHJKLMNPQRSTVWXYZ23456789";

/**
 * A one-time password for an account the desk creates on someone's behalf. It
 * is shown once, handed over, and never stored in readable form — so it has to
 * survive being written on a scrap of paper or spelled out over a counter.
 */
export function temporaryPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += READABLE[randomInt(READABLE.length)];
  }
  return out;
}

/** A one-time transfer account number for the sandbox gateway. */
export function virtualAccountNumber(): string {
  return `998${randomInt(1_000_000, 9_999_999)}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
