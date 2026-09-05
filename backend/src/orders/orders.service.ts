import { Order } from "../db/models/Order.js";

export async function recordOrder(params: {
  razorpayOrderId: string;
  chainId: string;
  userId: string;
  merchantId: string;
  status: "created" | "blocked";
  amountInPaise: number;
}): Promise<void> {
  await Order.create(params);
}

/** Sum of `created` (i.e. allowed-through-policy) order amounts for this user/merchant since local midnight. */
export async function getDayTotalInPaise(userId: string, merchantId: string, now: Date = new Date()): Promise<number> {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const result = await Order.aggregate<{ total: number }>([
    { $match: { userId, merchantId, status: "created", createdAt: { $gte: startOfDay } } },
    { $group: { _id: null, total: { $sum: "$amountInPaise" } } },
  ]);

  return result[0]?.total ?? 0;
}
