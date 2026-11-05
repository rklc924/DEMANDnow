// Membership tiers. Prices in CAD, approved by Rocky 2026-11-05.
// Annual = 10 x monthly (two months free).

export type PlanId = "standard" | "unlimited";
export type Interval = "monthly" | "annual";

export interface Plan {
  id: PlanId;
  name: string;
  /** Demand letters (new matters) per calendar month. null = unlimited. */
  letterLimit: number | null;
  price: Record<Interval, number>;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  standard: {
    id: "standard",
    name: "Standard",
    letterLimit: 10,
    price: { monthly: 99, annual: 990 },
    features: [
      "Up to 10 demand letters a month",
      "Accounting sync and 90-day alerts",
      "BC enforcement guides and court form data",
      "Lawyer review available as an add-on",
    ],
  },
  unlimited: {
    id: "unlimited",
    name: "Unlimited",
    letterLimit: null,
    price: { monthly: 249, annual: 2490 },
    features: [
      "Unlimited demand letters",
      "Everything in Standard",
      "Auto-send for business customers",
      "Priority lawyer review",
    ],
  },
};

export const priceLabel = (p: Plan, i: Interval) =>
  `$${p.price[i].toLocaleString("en-CA")} / ${i === "monthly" ? "month" : "year"}`;
