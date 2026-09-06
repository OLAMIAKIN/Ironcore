"use client";

import { api } from "./api";
import { useApi, type Query } from "./use-api";
import { useSession } from "./session";

/**
 * The shapes the API returns, and the hooks that fetch them. Keeping them in
 * one file means a change to a payload shows up as one compile error here
 * rather than five scattered through the screens.
 */

export type Gym = {
  id: string;
  name: string;
  branch: string;
  area: string;
  slug: string;
  dayPassPrice: number;
  about?: string;
};

export type OwnerGym = Gym & {
  status: "draft" | "active" | "suspended";
  listing?: {
    planId: string;
    planName: string;
    price: number;
    status: string;
    currentPeriodEnd?: string;
  };
  settlementAccount?: {
    bankName: string;
    accountName: string;
    accountLast4: string;
    verifiedAt?: string;
    /** The payout handles belong to a different gateway and no longer work. */
    needsReconnect: boolean;
  };
};

export type Plan = {
  _id: string;
  name: string;
  price: number;
  durationDays: number;
  perks?: string;
  popular?: boolean;
  active: boolean;
};

export type ListingPlan = {
  id: string;
  name: string;
  price: number;
  period: string;
  durationDays: number;
  tagline: string;
  perks: string[];
  recommended?: boolean;
};

export type MemberSubscription = {
  id: string;
  gym: { id: string; name: string; branch: string; area: string };
  plan: { id: string; name: string; price: number; durationDays: number };
  status: "pending" | "active" | "expired" | "cancelled";
  expiresAt?: string;
  daysLeft: number;
  autoRenew: boolean;
  qrToken: string;
};

export type RosterRow = {
  id: string;
  memberId: string;
  name: string;
  phone: string;
  plan: string;
  status: string;
  expiresAt?: string;
  daysLeft: number;
  /** Until they sign in, the desk can still re-issue their sign-in details. */
  hasLoggedIn?: boolean;
};

/** A guest pass, as the member's own screen sees it. */
export type DayPass = {
  id: string;
  token: string;
  gymId: string;
  gym: { name: string; branch: string; area: string };
  validUntil: string;
  usedAt?: string;
};

/** What a gym hands a member so they can sign in for the first time. */
export type MemberCredentials = {
  id: string;
  name: string;
  phone: string;
  plan: string;
  qrToken: string;
  isNewAccount: boolean;
  /** Absent when the number already had an account with its own password. */
  temporaryPassword?: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

/** Owner money. Every amount is the gym's own share, never the gross. */
export type OwnerSummary = {
  earned: number;
  pendingSettlement: number;
  settled: number;
  payments: number;
  activeMembers: number;
};

export type OwnerPaymentRow = {
  id: string;
  member: string;
  kind: "Renewal" | "Day pass";
  amount: number;
  status: "pending" | "settled";
  date: string;
};

export type SettlementRow = {
  id: string;
  reference: string;
  amount: number;
  payments: number;
  status: "processing" | "paid" | "failed";
  bankName: string;
  accountLast4: string;
  paidAt?: string;
  createdAt?: string;
};

export type Bank = { name: string; code: string };

export type ScanResult = {
  allowed: boolean;
  status: string;
  detail: string;
  kind: "member" | "day_pass" | "unknown";
  offerRenewal?: boolean;
};

/* ------------------------------------------------------------------
   Reads
   ------------------------------------------------------------------ */

export function useGyms(search = ""): Query<Paginated<Gym>> {
  const query = search ? `?q=${encodeURIComponent(search)}&limit=20` : "?limit=20";
  return useApi<Paginated<Gym>>(`/gyms${query}`);
}

export function usePlans(gymId: string | undefined): Query<{ items: Plan[] }> {
  return useApi<{ items: Plan[] }>(gymId ? `/gyms/${gymId}/plans` : null);
}

export function useListingPlans(): Query<{ items: ListingPlan[] }> {
  return useApi<{ items: ListingPlan[] }>("/listing-plans");
}

export function useMySubscriptions(): Query<{ items: MemberSubscription[] }> {
  const { user } = useSession();
  return useApi<{ items: MemberSubscription[] }>(
    user?.role === "member" ? "/me/subscriptions" : null,
  );
}

/** The staff member's own gym, with the private fields their role may see. */
export function useMyGym(): Query<OwnerGym> {
  const { user } = useSession();
  return useApi<OwnerGym>(user && user.role !== "member" ? "/me/gym" : null);
}

export function useOwnerSummary(
  gymId: string | undefined,
  days: number,
): Query<OwnerSummary> {
  return useApi<OwnerSummary>(
    gymId ? `/gyms/${gymId}/payments/summary?days=${days}` : null,
  );
}

export function useOwnerDaily(
  gymId: string | undefined,
  days: number,
): Query<{ items: { date: string; amount: number }[] }> {
  return useApi<{ items: { date: string; amount: number }[] }>(
    gymId ? `/gyms/${gymId}/payments/daily?days=${days}` : null,
  );
}

export function useOwnerPayments(
  gymId: string | undefined,
  days: number,
): Query<Paginated<OwnerPaymentRow>> {
  return useApi<Paginated<OwnerPaymentRow>>(
    gymId ? `/gyms/${gymId}/payments?days=${days}&limit=50` : null,
  );
}

export function useSettlements(
  gymId: string | undefined,
): Query<{ items: SettlementRow[] }> {
  return useApi<{ items: SettlementRow[] }>(
    gymId ? `/gyms/${gymId}/settlements` : null,
  );
}

export function useOverview(gymId: string | undefined): Query<{
  today: { earned: number; payments: number };
  activeMembers: number;
  expiring: RosterRow[];
}> {
  return useApi(gymId ? `/gyms/${gymId}/overview` : null);
}

export function useRoster(
  gymId: string | undefined,
  search: string,
): Query<Paginated<RosterRow>> {
  const query = search ? `?q=${encodeURIComponent(search)}&limit=50` : "?limit=50";
  return useApi<Paginated<RosterRow>>(
    gymId ? `/gyms/${gymId}/members${query}` : null,
  );
}

export function useStaff(gymId: string | undefined): Query<{
  items: {
    id: string;
    name: string;
    phone: string;
    role: "owner" | "manager" | "scanner";
    status: string;
    lastLoginAt?: string;
  }[];
}> {
  return useApi(gymId ? `/gyms/${gymId}/staff` : null);
}

export function useRecentCheckIns(gymId: string | undefined): Query<{
  items: { id: string; who: string; kind: string; allowed: boolean; at: string }[];
  today: number;
}> {
  return useApi(gymId ? `/gyms/${gymId}/checkins/recent` : null);
}

/**
 * Every pass they have bought, newest first. Read on every visit rather than
 * held from the purchase, so today's code survives a refresh or a new device.
 */
export function useMyDayPasses(): Query<{ items: DayPass[] }> {
  const { user } = useSession();
  return useApi<{ items: DayPass[] }>(
    user?.role === "member" ? "/me/day-passes" : null,
  );
}

/** A pass is good until closing time, and only for its first scan. */
export function isPassLive(pass: DayPass): boolean {
  return !pass.usedAt && new Date(pass.validUntil).getTime() > Date.now();
}

export function useBanks(): Query<{ items: Bank[] }> {
  return useApi<{ items: Bank[] }>("/banks");
}

/* ------------------------------------------------------------------
   Writes
   ------------------------------------------------------------------ */

export function resolveAccount(bankCode: string, accountNumber: string) {
  return api.post<{ accountName: string }>("/banks/resolve", {
    bankCode,
    accountNumber,
  });
}

export function saveSettlementAccount(
  gymId: string,
  bankCode: string,
  accountNumber: string,
) {
  return api.put<OwnerGym>(`/gyms/${gymId}/settlement-account`, {
    bankCode,
    accountNumber,
  });
}

export function scanToken(gymId: string, token: string) {
  return api.post<ScanResult>(`/gyms/${gymId}/checkins/scan`, { token });
}

/**
 * Mints fresh sign-in details for a member who never received theirs. The old
 * password cannot be recovered — only its hash was stored — so this replaces
 * it, and the API refuses once the member has signed in even once.
 */
export function reissueCredentials(gymId: string, memberId: string) {
  return api.post<MemberCredentials>(
    `/gyms/${gymId}/members/${memberId}/credentials`,
  );
}

export function addMember(
  gymId: string,
  input: { name: string; phone: string; planId: string },
) {
  return api.post<MemberCredentials>(`/gyms/${gymId}/members`, input);
}

export function addStaff(
  gymId: string,
  input: { name: string; phone: string; role: "manager" | "scanner"; password: string },
) {
  return api.post<{ id: string }>(`/gyms/${gymId}/staff`, input);
}

export function createPlan(
  gymId: string,
  input: { name: string; price: number; durationDays: number; perks?: string },
) {
  return api.post<Plan>(`/gyms/${gymId}/plans`, input);
}

export function retirePlan(gymId: string, planId: string) {
  return api.del<void>(`/gyms/${gymId}/plans/${planId}`);
}

export function updateGym(
  gymId: string,
  input: { name?: string; branch?: string; area?: string; dayPassPrice?: number },
) {
  return api.patch<OwnerGym>(`/gyms/${gymId}`, input);
}
