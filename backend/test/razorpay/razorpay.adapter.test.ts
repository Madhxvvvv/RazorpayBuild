import { describe, expect, it, vi } from "vitest";
import { createRazorpayAdapter, type RazorpayClientLike } from "../../src/razorpay/razorpay.adapter.js";

function makeFakeClient(overrides: Partial<RazorpayClientLike> = {}): RazorpayClientLike {
  return {
    orders: {
      create: vi.fn().mockResolvedValue({
        id: "order_test123",
        amount: 9900,
        currency: "INR",
        receipt: "receipt-1",
        status: "created",
      }),
    },
    payments: {
      capture: vi.fn().mockResolvedValue({
        id: "pay_test123",
        order_id: "order_test123",
        amount: 9900,
        currency: "INR",
        status: "captured",
        captured: true,
      }),
      refund: vi.fn().mockResolvedValue({
        id: "rfnd_test123",
        payment_id: "pay_test123",
        amount: 9900,
        status: "processed",
      }),
    },
    paymentLink: {
      create: vi.fn().mockResolvedValue({
        id: "plink_test123",
        short_url: "https://rzp.io/i/test123",
        amount: 9900,
        currency: "INR",
        status: "created",
      }),
    },
    ...overrides,
  };
}

describe("RazorpayAdapter", () => {
  it("createOrder passes amount/currency/receipt through and maps the response", async () => {
    const client = makeFakeClient();
    const adapter = createRazorpayAdapter(client);

    const order = await adapter.createOrder(9900, "INR", "receipt-1");

    expect(client.orders.create).toHaveBeenCalledWith({ amount: 9900, currency: "INR", receipt: "receipt-1" });
    expect(order).toEqual({
      id: "order_test123",
      amountInPaise: 9900,
      currency: "INR",
      receipt: "receipt-1",
      status: "created",
    });
  });

  it("capturePayment always captures in INR and maps the response", async () => {
    const client = makeFakeClient();
    const adapter = createRazorpayAdapter(client);

    const payment = await adapter.capturePayment("pay_test123", 9900);

    expect(client.payments.capture).toHaveBeenCalledWith("pay_test123", 9900, "INR");
    expect(payment).toEqual({
      id: "pay_test123",
      orderId: "order_test123",
      amountInPaise: 9900,
      currency: "INR",
      status: "captured",
      captured: true,
    });
  });

  it("createPaymentLink forwards amount/description and maps the response", async () => {
    const client = makeFakeClient();
    const adapter = createRazorpayAdapter(client);

    const link = await adapter.createPaymentLink(9900, "Protein bar order");

    expect(client.paymentLink.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 9900, currency: "INR", description: "Protein bar order" }),
    );
    expect(link).toEqual({
      id: "plink_test123",
      shortUrl: "https://rzp.io/i/test123",
      amountInPaise: 9900,
      currency: "INR",
      status: "created",
    });
  });

  it("refund forwards paymentId/amount and maps the response", async () => {
    const client = makeFakeClient();
    const adapter = createRazorpayAdapter(client);

    const refund = await adapter.refund("pay_test123", 9900);

    expect(client.payments.refund).toHaveBeenCalledWith("pay_test123", { amount: 9900 });
    expect(refund).toEqual({
      id: "rfnd_test123",
      paymentId: "pay_test123",
      amountInPaise: 9900,
      status: "processed",
    });
  });

  it("propagates errors from the underlying client instead of swallowing them", async () => {
    const client = makeFakeClient({
      orders: { create: vi.fn().mockRejectedValue(new Error("BAD_REQUEST_ERROR: amount must be at least 100")) },
    });
    const adapter = createRazorpayAdapter(client);

    await expect(adapter.createOrder(50, "INR", "receipt-2")).rejects.toThrow(/amount must be at least 100/);
  });
});
