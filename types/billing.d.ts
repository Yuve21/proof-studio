/**
 * Types for the billing modules, which are plain .mjs so the licence code can be
 * run directly by node and bundled into a CLI without a build step.
 *
 * `PlanId` as a union is the point rather than a formality: a route that names a
 * plan the catalog does not define fails `npm run typecheck` at the call site, in
 * addition to being refused at runtime. Two lists that only the compiler
 * reconciles is a legitimate arrangement and stronger than a test (L-19).
 */

declare module "*/lib/billing/catalog.mjs" {
  export const PLANS: Record<PlanId, Plan>;
  export function planForPriceId(priceId: string | undefined | null): Plan | null;
  export function priceIdFor(planId: string): string | null;
  export const LICENCE_BUFFER_DAYS: number;
}

declare module "*/lib/billing/issueForPayment.mjs" {
  export const ACTIVE_KEY_ID: string;
  export class BillingLicenceError extends Error {}
  export function licenceForPaidPeriod(args: {
    customerId: string;
    priceId: string | undefined | null;
    periodEndSeconds: number | null;
  }): { token: string; plan: Plan; expires: Date } | null;
  export function sessionIsPaid(session: { payment_status?: string | null } | null | undefined): boolean;
}

type PlanId = "kept-online" | "kept-sharp";

interface Plan {
  id: PlanId;
  name: string;
  /** Tier names or agent ids this plan entitles. Empty means no agent access. */
  agents: string[];
  /** The env var holding this plan's Stripe price id. Never the id itself. */
  priceEnv: string;
  monthlyFrom: number;
}
