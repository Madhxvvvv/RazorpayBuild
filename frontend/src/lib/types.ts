export interface Consent {
  userId: string;
  merchantId: string;
  spendCapPerTxn: number;
  spendCapPerDay: number;
  categoryAllowlist: string[];
  expiresAt: string;
  revoked: boolean;
}

export interface ProposedCartItem {
  sku: string;
  qty: number;
}

export type FailureMode = "decline" | "out_of_stock" | "cap_breach";

export type OrchestratorResult =
  | { type: "reply"; chainId: string; text: string; note?: string }
  | { type: "step_up"; chainId: string; reason: string; totalInPaise: number; items: ProposedCartItem[]; note?: string }
  | { type: "denied"; chainId: string; reason: string; note?: string }
  | { type: "executed"; chainId: string; razorpayOrderId: string; paymentLinkUrl: string; amountInPaise: number; note?: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
}
