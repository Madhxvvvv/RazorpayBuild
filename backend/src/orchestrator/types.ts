import type { FailureMode } from "./failure-injector.js";

export interface ProposedCartItem {
  sku: string;
  qty: number;
}

export type OrchestratorResult =
  | { type: "reply"; chainId: string; text: string; note?: string }
  | { type: "step_up"; chainId: string; reason: string; totalInPaise: number; items: ProposedCartItem[]; note?: string }
  | { type: "denied"; chainId: string; reason: string; note?: string }
  | {
      type: "executed";
      chainId: string;
      razorpayOrderId: string;
      paymentLinkUrl: string;
      amountInPaise: number;
      note?: string;
    };

export interface HandleMessageParams {
  userId: string;
  merchantId: string;
  chainId?: string;
  message: string;
  /** Set when this turn is the user's "yes" in response to a prior step_up prompt. */
  confirmStepUp?: boolean;
  /** Demo-only forced failure, per the Failure Injector (section 3.7). */
  forcedFailure?: FailureMode;
}
