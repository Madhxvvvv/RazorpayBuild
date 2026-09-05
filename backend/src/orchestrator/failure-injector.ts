// Demo-only forced-failure toggle, per docs/track1-agentic-storefront-architecture.md
// section 3.7. Adapted to this build's actual architecture: since Phase 4 uses
// Razorpay Payment Links rather than direct capture (see CLAUDE.md), "decline"
// is adapted from "retry via payment link instead of direct capture" to
// "the first order-creation call fails, the retry succeeds" — the ledger still
// shows a break record and a resolution record, which is the actual point.
export type FailureMode = "decline" | "out_of_stock" | "cap_breach";

const FAILURE_MODES: readonly FailureMode[] = ["decline", "out_of_stock", "cap_breach"];

export function parseFailureMode(headerValue: unknown): FailureMode | undefined {
  if (typeof headerValue === "string" && (FAILURE_MODES as readonly string[]).includes(headerValue)) {
    return headerValue as FailureMode;
  }
  return undefined;
}
