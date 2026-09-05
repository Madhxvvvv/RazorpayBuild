// Matches docs/track1-agentic-storefront-architecture.md section 3.4.
export type MandateType = "INTENT" | "CART" | "PAYMENT" | "EXECUTION";

export interface MandateRecord {
  chainId: string;
  seq: number;
  type: MandateType;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
  createdAt: Date;
}

export const GENESIS_HASH = "GENESIS";

export type ChainVerificationResult =
  | { valid: true; length: number }
  | { valid: false; brokenAtSeq: number; reason: string };
