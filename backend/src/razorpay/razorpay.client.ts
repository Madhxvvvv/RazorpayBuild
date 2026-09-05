import Razorpay from "razorpay";
import type { RazorpayClientLike } from "./razorpay.adapter.js";

export function createLiveRazorpayClient(keyId: string, keySecret: string): RazorpayClientLike {
  const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return {
    orders: {
      create: (params) => client.orders.create(params),
    },
    payments: {
      capture: (paymentId, amount, currency) => client.payments.capture(paymentId, amount, currency),
      refund: (paymentId, params) => client.payments.refund(paymentId, params),
    },
    paymentLink: {
      create: (params) => client.paymentLink.create(params),
    },
  };
}
