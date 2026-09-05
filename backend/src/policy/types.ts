// Matches docs/track1-agentic-storefront-architecture.md section 3.1 / 3.3.
export interface Consent {
  userId: string;
  merchantId: string;
  spendCapPerTxn: number; // paise
  spendCapPerDay: number; // paise
  categoryAllowlist: string[];
  expiresAt: Date;
  revoked: boolean;
}

export interface CartItem {
  sku: string;
  category: string;
  qty: number;
  unitPriceInPaise: number;
}

export interface CartMandate {
  chainId: string;
  items: CartItem[];
  totalInPaise: number;
}

export type PolicyResult =
  | { decision: "ALLOW" }
  | { decision: "STEP_UP"; reason: string }
  | { decision: "DENY"; reason: string };
