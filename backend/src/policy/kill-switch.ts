// In-memory per-merchant kill switch. The Policy Engine itself stays a pure
// function (see policy.engine.ts) — it takes a boolean, it doesn't reach into
// this store. This module is the one mutable place that boolean comes from,
// wired up by the Admin Dashboard in a later phase.
const engagedMerchants = new Set<string>();

export function engage(merchantId: string): void {
  engagedMerchants.add(merchantId);
}

export function disengage(merchantId: string): void {
  engagedMerchants.delete(merchantId);
}

export function isEngaged(merchantId: string): boolean {
  return engagedMerchants.has(merchantId);
}

export function resetAll(): void {
  engagedMerchants.clear();
}
