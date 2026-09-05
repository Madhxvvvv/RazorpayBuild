import type { CartMandate, Consent, PolicyResult } from "./types.js";

export interface EvaluateParams {
  cart: CartMandate;
  consent: Consent;
  dayTotalSoFar: number;
  killSwitchEngaged: boolean;
  /** Set once the user has explicitly confirmed a STEP_UP prompt for this same cart. */
  userConfirmedStepUp?: boolean;
  now?: Date;
}

/**
 * Deterministic, pure. No LLM, no network, no DB — every input it needs is
 * passed in explicitly so it can be unit-tested without mocking anything.
 * Checks run in a fixed order: kill switch/revocation, expiry, category
 * allowlist, daily cap, then per-transaction cap.
 */
export function evaluate(params: EvaluateParams): PolicyResult {
  const {
    cart,
    consent,
    dayTotalSoFar,
    killSwitchEngaged,
    userConfirmedStepUp = false,
    now = new Date(),
  } = params;

  if (killSwitchEngaged) {
    return { decision: "DENY", reason: "kill switch engaged" };
  }
  if (consent.revoked) {
    return { decision: "DENY", reason: "consent revoked" };
  }
  if (consent.expiresAt.getTime() <= now.getTime()) {
    return { decision: "DENY", reason: "consent expired" };
  }
  if (!cart.items.every((item) => consent.categoryAllowlist.includes(item.category))) {
    return { decision: "DENY", reason: "category not allow-listed" };
  }
  if (dayTotalSoFar + cart.totalInPaise > consent.spendCapPerDay) {
    return { decision: "DENY", reason: "daily cap exceeded" };
  }
  if (cart.totalInPaise > consent.spendCapPerTxn && !userConfirmedStepUp) {
    return { decision: "STEP_UP", reason: "exceeds per-transaction auto-approve limit" };
  }
  return { decision: "ALLOW" };
}
