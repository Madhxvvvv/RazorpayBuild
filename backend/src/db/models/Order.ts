import { Schema, model, type InferSchemaType } from "mongoose";

// Matches docs/track1-agentic-storefront-architecture.md section 4's `orders`
// table (razorpayOrderId, chainId, status, amount), plus userId/merchantId —
// added so the Policy Engine's daily-cap check can sum a user's spend across
// chains without joining back through the mandate ledger every time.
const orderSchema = new Schema(
  {
    razorpayOrderId: { type: String, required: true },
    chainId: { type: String, required: true },
    userId: { type: String, required: true },
    merchantId: { type: String, required: true },
    status: { type: String, required: true, enum: ["created", "blocked"] },
    amountInPaise: { type: Number, required: true },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, merchantId: 1, createdAt: 1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const Order = model("Order", orderSchema);
