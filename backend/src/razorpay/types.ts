// Deliberately narrow — just the fields the rest of the app actually reads.
// This is the whole point of an adapter: nothing outside this folder should
// need to know the Razorpay SDK's raw response shape.
export interface RPOrder {
  id: string;
  amountInPaise: number;
  currency: string;
  receipt: string | null;
  status: string;
}

export interface RPPayment {
  id: string;
  orderId: string | null;
  amountInPaise: number;
  currency: string;
  status: string;
  captured: boolean;
}

export interface RPPaymentLink {
  id: string;
  shortUrl: string;
  amountInPaise: number;
  currency: string;
  status: string;
}

export interface RPRefund {
  id: string;
  paymentId: string;
  amountInPaise: number;
  status: string;
}

// Matches docs/track1-agentic-storefront-architecture.md section 3.5 exactly.
// This is the ONLY interface the rest of the app is allowed to depend on —
// nothing outside src/razorpay/ should import the Razorpay SDK directly.
export interface RazorpayAdapter {
  createOrder(amountPaise: number, currency: "INR", receipt: string): Promise<RPOrder>;
  capturePayment(paymentId: string, amountPaise: number): Promise<RPPayment>;
  createPaymentLink(amountPaise: number, description: string): Promise<RPPaymentLink>;
  refund(paymentId: string, amountPaise: number): Promise<RPRefund>;
}
