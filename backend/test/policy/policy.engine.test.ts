import { describe, expect, it } from "vitest";
import { evaluate } from "../../src/policy/policy.engine.js";
import type { CartMandate, Consent } from "../../src/policy/types.js";

const NOW = new Date("2026-09-05T12:00:00.000Z");

function makeConsent(overrides: Partial<Consent> = {}): Consent {
  return {
    userId: "user-1",
    merchantId: "merchant-1",
    spendCapPerTxn: 50000, // 500 INR
    spendCapPerDay: 200000, // 2000 INR
    categoryAllowlist: ["food", "groceries"],
    expiresAt: new Date("2026-12-31T23:59:59.000Z"),
    revoked: false,
    ...overrides,
  };
}

function makeCart(overrides: Partial<CartMandate> = {}): CartMandate {
  return {
    chainId: "chain-1",
    items: [{ sku: "FOOD-PBAR-001", category: "food", qty: 1, unitPriceInPaise: 9900 }],
    totalInPaise: 9900,
    ...overrides,
  };
}

describe("policy engine evaluate()", () => {
  it("allows a cart within category, per-txn cap, and daily cap", () => {
    const result = evaluate({
      cart: makeCart(),
      consent: makeConsent(),
      dayTotalSoFar: 0,
      killSwitchEngaged: false,
      now: NOW,
    });
    expect(result).toEqual({ decision: "ALLOW" });
  });

  it("denies when a cart item's category is not allow-listed", () => {
    const result = evaluate({
      cart: makeCart({ items: [{ sku: "ELEC-CABLE-001", category: "electronics", qty: 1, unitPriceInPaise: 34900 }], totalInPaise: 34900 }),
      consent: makeConsent(),
      dayTotalSoFar: 0,
      killSwitchEngaged: false,
      now: NOW,
    });
    expect(result).toEqual({ decision: "DENY", reason: "category not allow-listed" });
  });

  it("denies when the kill switch is engaged, regardless of cart", () => {
    const result = evaluate({
      cart: makeCart(),
      consent: makeConsent(),
      dayTotalSoFar: 0,
      killSwitchEngaged: true,
      now: NOW,
    });
    expect(result).toEqual({ decision: "DENY", reason: "kill switch engaged" });
  });

  it("denies when consent has been revoked", () => {
    const result = evaluate({
      cart: makeCart(),
      consent: makeConsent({ revoked: true }),
      dayTotalSoFar: 0,
      killSwitchEngaged: false,
      now: NOW,
    });
    expect(result).toEqual({ decision: "DENY", reason: "consent revoked" });
  });

  it("denies when consent has expired", () => {
    const result = evaluate({
      cart: makeCart(),
      consent: makeConsent({ expiresAt: new Date("2026-01-01T00:00:00.000Z") }),
      dayTotalSoFar: 0,
      killSwitchEngaged: false,
      now: NOW,
    });
    expect(result).toEqual({ decision: "DENY", reason: "consent expired" });
  });

  it("denies when the cart would exceed the remaining daily cap", () => {
    const result = evaluate({
      cart: makeCart({ totalInPaise: 5000 }),
      consent: makeConsent({ spendCapPerDay: 200000 }),
      dayTotalSoFar: 198000,
      killSwitchEngaged: false,
      now: NOW,
    });
    expect(result).toEqual({ decision: "DENY", reason: "daily cap exceeded" });
  });

  it("requires step-up when the cart exceeds the per-transaction cap but not the daily cap", () => {
    const result = evaluate({
      cart: makeCart({ totalInPaise: 60000 }),
      consent: makeConsent({ spendCapPerTxn: 50000, spendCapPerDay: 200000 }),
      dayTotalSoFar: 0,
      killSwitchEngaged: false,
      now: NOW,
    });
    expect(result).toEqual({
      decision: "STEP_UP",
      reason: "exceeds per-transaction auto-approve limit",
    });
  });

  it("allows a step-up cart once the user has explicitly confirmed it", () => {
    const result = evaluate({
      cart: makeCart({ totalInPaise: 60000 }),
      consent: makeConsent({ spendCapPerTxn: 50000, spendCapPerDay: 200000 }),
      dayTotalSoFar: 0,
      killSwitchEngaged: false,
      userConfirmedStepUp: true,
      now: NOW,
    });
    expect(result).toEqual({ decision: "ALLOW" });
  });

  it("still enforces the daily cap even when the user confirms a step-up", () => {
    const result = evaluate({
      cart: makeCart({ totalInPaise: 60000 }),
      consent: makeConsent({ spendCapPerTxn: 50000, spendCapPerDay: 200000 }),
      dayTotalSoFar: 190000,
      killSwitchEngaged: false,
      userConfirmedStepUp: true,
      now: NOW,
    });
    expect(result).toEqual({ decision: "DENY", reason: "daily cap exceeded" });
  });
});
