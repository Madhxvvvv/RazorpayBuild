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

export type OrchestratorResult =
  | { type: "reply"; chainId: string; text: string }
  | { type: "step_up"; chainId: string; reason: string; totalInPaise: number; items: ProposedCartItem[] }
  | { type: "denied"; chainId: string; reason: string }
  | { type: "executed"; chainId: string; razorpayOrderId: string; paymentLinkUrl: string; amountInPaise: number };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
}
