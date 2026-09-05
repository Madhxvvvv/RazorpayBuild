import { describe, expect, it } from "vitest";
import { mapOrder, mapPayment, mapPaymentLink, mapRefund } from "../../src/razorpay/mappers.js";

describe("mapOrder", () => {
  it("coerces a string amount to a number", () => {
    expect(mapOrder({ id: "order_1", amount: "9900", currency: "INR", receipt: "r1", status: "created" }))
      .toEqual({ id: "order_1", amountInPaise: 9900, currency: "INR", receipt: "r1", status: "created" });
  });

  it("defaults a missing receipt to null", () => {
    const result = mapOrder({ id: "order_1", amount: 9900, currency: "INR", status: "created" });
    expect(result.receipt).toBeNull();
  });
});

describe("mapPayment", () => {
  it("defaults a missing order_id to null", () => {
    const result = mapPayment({ id: "pay_1", amount: 9900, currency: "INR", status: "created" });
    expect(result.orderId).toBeNull();
  });

  it("derives captured from status when the flag is absent", () => {
    const captured = mapPayment({ id: "pay_1", amount: 9900, currency: "INR", status: "captured" });
    const authorized = mapPayment({ id: "pay_1", amount: 9900, currency: "INR", status: "authorized" });
    expect(captured.captured).toBe(true);
    expect(authorized.captured).toBe(false);
  });
});

describe("mapPaymentLink", () => {
  it("maps short_url to shortUrl", () => {
    const result = mapPaymentLink({ id: "plink_1", short_url: "https://rzp.io/i/x", amount: 9900, currency: "INR", status: "created" });
    expect(result.shortUrl).toBe("https://rzp.io/i/x");
  });
});

describe("mapRefund", () => {
  it("defaults a missing amount to 0", () => {
    const result = mapRefund({ id: "rfnd_1", payment_id: "pay_1", status: "processed" });
    expect(result.amountInPaise).toBe(0);
  });
});
