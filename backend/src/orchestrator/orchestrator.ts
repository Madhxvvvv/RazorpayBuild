import { randomUUID } from "node:crypto";
import { Product } from "../db/models/Product.js";
import { getConsent } from "../consent/consent.service.js";
import { appendMandate, getChain } from "../ledger/ledger.service.js";
import { getDayTotalInPaise, recordOrder } from "../orders/orders.service.js";
import { evaluate } from "../policy/policy.engine.js";
import { isEngaged } from "../policy/kill-switch.js";
import type { CartMandate } from "../policy/types.js";
import type { RazorpayAdapter } from "../razorpay/types.js";
import { buildCartMandate, type CatalogProductLookup } from "./cart-builder.js";
import type { LlmLoopResult } from "./llm-loop.js";
import type { HandleMessageParams, OrchestratorResult } from "./types.js";

export interface OrchestratorDeps {
  runLlmLoop: (message: string) => Promise<LlmLoopResult>;
  razorpayAdapter: RazorpayAdapter;
}

async function lookupProducts(skus: string[]): Promise<Map<string, CatalogProductLookup>> {
  const docs = await Product.find({ sku: { $in: skus } }).lean();
  const map = new Map<string, CatalogProductLookup>();
  for (const doc of docs) {
    map.set(doc.sku, {
      category: doc.category,
      priceInPaise: doc.priceInPaise,
      maxQtyPerOrder: doc.maxQtyPerOrder,
      stock: doc.stock,
    });
  }
  return map;
}

function describeCart(cart: CartMandate): string {
  return cart.items.map((i) => `${i.sku} x${i.qty}`).join(", ");
}

export function createOrchestrator(deps: OrchestratorDeps) {
  async function executeAllowedCart(
    chainId: string,
    userId: string,
    merchantId: string,
    cart: CartMandate,
  ): Promise<OrchestratorResult> {
    const receipt = `${chainId}-${Date.now()}`;
    const order = await deps.razorpayAdapter.createOrder(cart.totalInPaise, "INR", receipt);
    const paymentLink = await deps.razorpayAdapter.createPaymentLink(cart.totalInPaise, describeCart(cart));

    await appendMandate(chainId, "PAYMENT", {
      amountInPaise: cart.totalInPaise,
      instrument: "razorpay_payment_link",
      razorpayOrderId: order.id,
    });
    await appendMandate(chainId, "EXECUTION", {
      result: "payment_link_created",
      razorpayOrderId: order.id,
      paymentLinkUrl: paymentLink.shortUrl,
    });
    await recordOrder({
      razorpayOrderId: order.id,
      chainId,
      userId,
      merchantId,
      status: "created",
      amountInPaise: cart.totalInPaise,
    });

    return {
      type: "executed",
      chainId,
      razorpayOrderId: order.id,
      paymentLinkUrl: paymentLink.shortUrl,
      amountInPaise: cart.totalInPaise,
    };
  }

  async function denyCart(chainId: string, reason: string): Promise<OrchestratorResult> {
    await appendMandate(chainId, "EXECUTION", { result: "blocked", reason });
    return { type: "denied", chainId, reason };
  }

  async function handleMessage(params: HandleMessageParams): Promise<OrchestratorResult> {
    const { userId, merchantId, message } = params;
    const chainId = params.chainId ?? randomUUID();

    const consent = await getConsent(userId, merchantId);
    if (!consent) {
      return { type: "denied", chainId, reason: "no consent on file for this merchant" };
    }

    const killSwitchEngaged = isEngaged(merchantId);
    const dayTotalSoFar = await getDayTotalInPaise(userId, merchantId);

    if (params.confirmStepUp) {
      const chain = await getChain(chainId);
      const lastCart = [...chain].reverse().find((r) => r.type === "CART");
      if (!lastCart) {
        return { type: "reply", chainId, text: "There's nothing pending for me to confirm." };
      }

      const cart = lastCart.payload as unknown as CartMandate;
      const result = evaluate({ cart, consent, dayTotalSoFar, killSwitchEngaged, userConfirmedStepUp: true });

      if (result.decision === "DENY") {
        return denyCart(chainId, result.reason);
      }
      return executeAllowedCart(chainId, userId, merchantId, cart);
    }

    await appendMandate(chainId, "INTENT", { rawAsk: message });

    const loopResult = await deps.runLlmLoop(message);
    if (loopResult.type === "text") {
      return { type: "reply", chainId, text: loopResult.text };
    }

    const skus = [...new Set(loopResult.items.map((i) => i.sku))];
    const productsBySku = await lookupProducts(skus);
    const built = buildCartMandate(chainId, loopResult.items, productsBySku);

    if (!built.ok) {
      return { type: "reply", chainId, text: `I couldn't complete that: ${built.error}` };
    }

    await appendMandate(chainId, "CART", { items: built.cart.items, totalInPaise: built.cart.totalInPaise });

    const result = evaluate({ cart: built.cart, consent, dayTotalSoFar, killSwitchEngaged });

    if (result.decision === "DENY") {
      return denyCart(chainId, result.reason);
    }
    if (result.decision === "STEP_UP") {
      return {
        type: "step_up",
        chainId,
        reason: result.reason,
        totalInPaise: built.cart.totalInPaise,
        items: loopResult.items,
      };
    }
    return executeAllowedCart(chainId, userId, merchantId, built.cart);
  }

  return { handleMessage };
}
