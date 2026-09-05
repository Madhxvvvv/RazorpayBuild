export interface ProposedCartItem {
  sku: string;
  qty: number;
}

export type OrchestratorResult =
  | { type: "reply"; chainId: string; text: string }
  | { type: "step_up"; chainId: string; reason: string; totalInPaise: number; items: ProposedCartItem[] }
  | { type: "denied"; chainId: string; reason: string }
  | {
      type: "executed";
      chainId: string;
      razorpayOrderId: string;
      paymentLinkUrl: string;
      amountInPaise: number;
    };

export interface HandleMessageParams {
  userId: string;
  merchantId: string;
  chainId?: string;
  message: string;
  /** Set when this turn is the user's "yes" in response to a prior step_up prompt. */
  confirmStepUp?: boolean;
}
