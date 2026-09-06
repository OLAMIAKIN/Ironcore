/**
 * What a gym pays IronCore to be listed. These are platform products, the same
 * for every gym, so they live in code rather than in a per-gym collection.
 */
export type ListingPlan = {
  id: string;
  name: string;
  price: number;
  period: string;
  /** How long one payment covers, in days. */
  durationDays: number;
  tagline: string;
  perks: string[];
  recommended?: boolean;
};

export const LISTING_PLANS: ListingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 15000,
    period: "/month",
    durationDays: 30,
    tagline: "One branch, and everything you need to open the door.",
    perks: [
      "Listed in member search",
      "Door scanner and guest passes",
      "Up to 200 active members",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 35000,
    period: "/month",
    durationDays: 30,
    tagline: "More branches, staff logins and the payment reports.",
    perks: [
      "Everything in Starter",
      "Unlimited members and branches",
      "Staff logins and roles",
      "Payments and settlement reports",
    ],
    recommended: true,
  },
];

export function listingPlanById(id: string): ListingPlan | undefined {
  return LISTING_PLANS.find((plan) => plan.id === id);
}
