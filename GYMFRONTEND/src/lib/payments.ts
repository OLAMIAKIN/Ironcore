"use client";

import { api } from "./api";
import { naira } from "./format";

/**
 * Payments, as the browser sees them. The amount is never sent from here — the
 * API prices the purchase itself and answers with what it will charge, which is
 * the only number the checkout is allowed to show.
 */

export type PaymentChannel = "card" | "opay" | "transfer";

export type ChannelInfo = {
  id: PaymentChannel;
  label: string;
  blurb: string;
};

export const CHANNELS: ChannelInfo[] = [
  {
    id: "card",
    label: "Card",
    blurb: "Debit or credit card. Charged once, right now.",
  },
  {
    id: "opay",
    label: "Opay",
    blurb: "Approve the prompt in your Opay app to pay from your wallet.",
  },
  {
    id: "transfer",
    label: "Bank transfer",
    blurb: "Send the exact amount to the one-time account below.",
  },
];

export function channelInfo(id: PaymentChannel): ChannelInfo {
  return CHANNELS.find((channel) => channel.id === id)!;
}

export function channelLabel(id: string): string {
  return CHANNELS.find((channel) => channel.id === id)?.label ?? "Card";
}

export type CheckoutSession = {
  reference: string;
  amount: number;
  currency: string;
  channel: PaymentChannel;
  purpose: "subscription" | "day_pass" | "listing";
  status: "pending" | "success" | "failed" | "abandoned";
  /** True while the sandbox gateway is configured on the API. */
  sandbox: boolean;
  /** Real gateway only — where to send the payer. */
  authorizationUrl?: string;
  transfer?: { bankName: string; accountNumber: string; expiresAt: string };
  /** The payer's own split. Absent on listing payments and owner endpoints. */
  split?: { gymNet: number; platformFee: number };
};

export type InitializeInput = {
  purpose: "subscription" | "day_pass" | "listing";
  channel: PaymentChannel;
  gymId?: string;
  planId?: string;
  listingPlanId?: string;
  guestName?: string;
};

export function initializePayment(input: InitializeInput) {
  return api.post<CheckoutSession>("/payments/initialize", input);
}

/** Sandbox only. The API refuses this outright when a real gateway is live. */
export function simulatePayment(
  reference: string,
  outcome: "success" | "failed",
) {
  return api.post<CheckoutSession>(`/payments/${reference}/simulate`, {
    outcome,
  });
}

export function paymentStatus(reference: string) {
  return api.get<CheckoutSession>(`/payments/${reference}`);
}

/** Waits for a real gateway to confirm, the way a callback page would. */
export async function waitForPayment(
  reference: string,
  { attempts = 20, intervalMs = 1500 } = {},
): Promise<CheckoutSession> {
  let session = await paymentStatus(reference);

  for (
    let attempt = 0;
    attempt < attempts && session.status === "pending";
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    session = await paymentStatus(reference);
  }

  return session;
}

/** The transparency line above a pay button — spelled out, not buried. */
export function splitSentence(
  gymName: string,
  split: { gymNet: number; platformFee: number },
): string {
  return `${gymName} receives ${naira(split.gymNet)} directly, and ${naira(split.platformFee)} is a platform fee that keeps IronCore running.`;
}
