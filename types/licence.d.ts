/**
 * Types for the licence modules, which are plain .mjs so they run directly under
 * node and bundle into the MCP CLI without a build step.
 *
 * `Entitlement` as a shape is load-bearing rather than documentation: a caller
 * that reads `licence.valid` and forgets `grace` fails `npm run typecheck` if the
 * field is ever removed, which is one gate earlier than any runtime test would
 * catch it (LEARNINGS L-19).
 */

declare module "*/licence/verify.mjs" {
  export const ISSUER_PUBLIC_KEYS: Record<string, string>;
  export const GRACE_DAYS: number;
  export const WARN_DAYS: number;
  export function entitlement(
    token: string,
    opts?: { now?: Date; publicKeys?: Record<string, string> },
  ): Entitlement;
}

declare module "*/licence/issue.mjs" {
  export function issue(args: {
    customer: string;
    agents: string[];
    expires: Date;
    privateKeyPem: string;
    keyId: string;
  }): string;
}

declare module "*/licence/roster.mjs" {
  export const TIERS: Record<string, string[]>;
  export const INTERNAL_SEATS: string[];
  export function customerFacing(roster: Map<string, Seat>): Seat[];
  export function loadRoster(planPath?: string): Map<string, Seat>;
  export function registrable(
    token: string,
    opts?: { now?: Date; publicKeys?: Record<string, string>; roster?: Map<string, Seat>; planPath?: string },
  ): { agents: Seat[]; licence: Entitlement; unknown: string[]; status: RegistrationStatus };
}

interface Seat {
  id: string;
  kind: "D" | "A";
  blurb: string;
}

/** success, failure, and succeeded-but-empty. Two states force the third to lie. */
type RegistrationStatus = "ok" | "unlicensed" | "entitles-nothing";

interface Entitlement {
  valid: boolean;
  reason: string;
  agents: string[];
  customer: string | null;
  expires: string | null;
  keyId: string | null;
  /** Set only while an expired licence is inside its grace window. */
  grace: { daysPastExpiry: number; endsAt: string } | null;
  /** Set only inside the warning window before expiry. */
  expiringSoon: { daysLeft: number } | null;
}
