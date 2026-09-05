import type { RPOrder, RPPayment, RPPaymentLink, RPRefund } from "./types.js";

// Raw shapes are typed loosely on purpose — they're whatever the Razorpay
// SDK hands back. The mapper is the only place that knows Razorpay's field
// names (snake_case, string-or-number amounts); everything past this point
// deals only in RP* types.

export function mapOrder(raw: {
  id: string;
  amount: number | string;
  currency: string;
  receipt?: string | null;
  status: string;
}): RPOrder {
  return {
    id: raw.id,
    amountInPaise: Number(raw.amount),
    currency: raw.currency,
    receipt: raw.receipt ?? null,
    status: raw.status,
  };
}

export function mapPayment(raw: {
  id: string;
  order_id?: string | null;
  amount: number | string;
  currency: string;
  status: string;
  captured?: boolean;
}): RPPayment {
  return {
    id: raw.id,
    orderId: raw.order_id ?? null,
    amountInPaise: Number(raw.amount),
    currency: raw.currency,
    status: raw.status,
    captured: raw.captured ?? raw.status === "captured",
  };
}

export function mapPaymentLink(raw: {
  id: string;
  short_url: string;
  amount: number | string;
  currency?: string;
  status: string;
}): RPPaymentLink {
  return {
    id: raw.id,
    shortUrl: raw.short_url,
    amountInPaise: Number(raw.amount),
    currency: raw.currency ?? "INR",
    status: raw.status,
  };
}

export function mapRefund(raw: {
  id: string;
  payment_id: string;
  amount?: number | string;
  status: string;
}): RPRefund {
  return {
    id: raw.id,
    paymentId: raw.payment_id,
    amountInPaise: Number(raw.amount ?? 0),
    status: raw.status,
  };
}
