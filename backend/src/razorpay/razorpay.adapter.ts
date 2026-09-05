import { mapOrder, mapPayment, mapPaymentLink, mapRefund } from "./mappers.js";
import type { RazorpayAdapter } from "./types.js";

// The slice of the real Razorpay SDK client this adapter actually calls.
// Keeping it as a narrow structural interface (rather than importing the
// SDK's own class type) is what makes the adapter testable with a plain
// mock object instead of real network calls.
export interface RazorpayClientLike {
  orders: {
    create(params: { amount: number; currency: string; receipt: string }): Promise<{
      id: string;
      amount: number | string;
      currency: string;
      receipt?: string | null;
      status: string;
    }>;
  };
  payments: {
    capture(
      paymentId: string,
      amount: number,
      currency: string,
    ): Promise<{
      id: string;
      order_id?: string | null;
      amount: number | string;
      currency: string;
      status: string;
      captured?: boolean;
    }>;
    refund(
      paymentId: string,
      params: { amount: number },
    ): Promise<{ id: string; payment_id: string; amount?: number | string; status: string }>;
  };
  paymentLink: {
    create(params: {
      amount: number;
      currency: string;
      description: string;
      customer: { name: string; email: string; contact: string };
    }): Promise<{ id: string; short_url: string; amount: number | string; currency?: string; status: string }>;
  };
}

/**
 * This is the only module allowed to talk to Razorpay (per section 3.5/3.6
 * of the architecture doc) — the orchestrator only ever gets a
 * RazorpayAdapter, never the raw client, and only after the Policy Engine
 * has returned ALLOW.
 */
export function createRazorpayAdapter(client: RazorpayClientLike): RazorpayAdapter {
  return {
    async createOrder(amountPaise, currency, receipt) {
      const raw = await client.orders.create({ amount: amountPaise, currency, receipt });
      return mapOrder(raw);
    },

    async capturePayment(paymentId, amountPaise) {
      const raw = await client.payments.capture(paymentId, amountPaise, "INR");
      return mapPayment(raw);
    },

    async createPaymentLink(amountPaise, description) {
      // Razorpay's payment-link API accepts links with no customer details
      // attached (notify.sms/email just stay off); the SDK's TypeScript
      // definitions mark `customer` as required even though the live API
      // does not enforce it, so a demo placeholder is supplied here rather
      // than widening the public RazorpayAdapter signature for one field.
      const raw = await client.paymentLink.create({
        amount: amountPaise,
        currency: "INR",
        description,
        customer: { name: "Storefront Buyer", email: "buyer@example.com", contact: "9876543210" },
      });
      return mapPaymentLink(raw);
    },

    async refund(paymentId, amountPaise) {
      const raw = await client.payments.refund(paymentId, { amount: amountPaise });
      return mapRefund(raw);
    },
  };
}
