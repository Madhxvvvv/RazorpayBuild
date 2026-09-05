import { randomUUID } from "node:crypto";
import { Product } from "../db/models/Product.js";
import { getConsent } from "../consent/consent.service.js";
import { findInStockAlternative } from "../catalog/catalog.service.js";
import { appendMandate, getChain } from "../ledger/ledger.service.js";
import { getDayTotalInPaise, recordOrder } from "../orders/orders.service.js";
import { evaluate } from "../policy/policy.engine.js";
import { isEngaged } from "../policy/kill-switch.js";
import type { CartMandate, Consent } from "../policy/types.js";
import type { RazorpayAdapter } from "../razorpay/types.js";
import { buildCartMandate, inflateCartToBreachCap, type CatalogProductLookup } from "./cart-builder.js";
import type { FailureMode } from "./failure-injector.js";
import type { LlmLoopResult } from "./llm-loop.js";
import type { HandleMessageParams, OrchestratorResult, ProposedCartItem } from "./types.js";

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
    forcedFailure?: FailureMode,
    note?: string,
  ): Promise<OrchestratorResult> {
    let resolvedNote = note;

    if (forcedFailure === "decline") {
      await appendMandate(chainId, "EXECUTION", {
        result: "razorpay_declined",
        reason: "simulated test-mode decline (forced by X-Force-Failure demo header)",
      });
      resolvedNote = [resolvedNote, "Your first payment attempt was declined (simulated) — retried automatically and it went through."]
        .filter(Boolean)
        .join(" ");
    }

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
      note: resolvedNote,
    };
  }

  async function denyCart(chainId: string, reason: string): Promise<OrchestratorResult> {
    await appendMandate(chainId, "EXECUTION", { result: "blocked", reason });
    return { type: "denied", chainId, reason };
  }

  /** out_of_stock injection: sku is forced unavailable; find a same-category substitute and continue with it. */
  async function handleOutOfStockInjection(
    chainId: string,
    userId: string,
    merchantId: string,
    items: ProposedCartItem[],
    productsBySku: Map<string, CatalogProductLookup>,
    consent: Consent,
    dayTotalSoFar: number,
    killSwitchEngaged: boolean,
  ): Promise<OrchestratorResult> {
    const target = items[0];
    const targetProduct = productsBySku.get(target.sku);
    if (!targetProduct) {
      return { type: "reply", chainId, text: `I couldn't complete that: unknown sku: ${target.sku}` };
    }

    await appendMandate(chainId, "EXECUTION", {
      result: "out_of_stock",
      sku: target.sku,
      note: "forced by X-Force-Failure demo header",
    });

    const alternative = await findInStockAlternative(targetProduct.category, target.sku);
    if (!alternative) {
      return denyCart(chainId, `${target.sku} is out of stock and no alternative is available`);
    }

    const substituteItems: ProposedCartItem[] = [{ sku: alternative.sku, qty: target.qty }, ...items.slice(1)];
    const substituteProducts = await lookupProducts(substituteItems.map((i) => i.sku));
    const built = buildCartMandate(chainId, substituteItems, substituteProducts);
    if (!built.ok) {
      return { type: "reply", chainId, text: `I couldn't complete that: ${built.error}` };
    }

    await appendMandate(chainId, "CART", {
      items: built.cart.items,
      totalInPaise: built.cart.totalInPaise,
      substituteFor: target.sku,
    });

    const note = `${target.sku} was out of stock, so I substituted ${alternative.sku} (${alternative.name}).`;
    const result = evaluate({ cart: built.cart, consent, dayTotalSoFar, killSwitchEngaged });

    if (result.decision === "DENY") {
      const denied = await denyCart(chainId, result.reason);
      return { ...denied, note };
    }
    if (result.decision === "STEP_UP") {
      return {
        type: "step_up",
        chainId,
        reason: result.reason,
        totalInPaise: built.cart.totalInPaise,
        items: substituteItems,
        note,
      };
    }
    return executeAllowedCart(chainId, userId, merchantId, built.cart, undefined, note);
  }

  async function handleMessage(params: HandleMessageParams): Promise<OrchestratorResult> {
    const { userId, merchantId, message, forcedFailure } = params;
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
      return executeAllowedCart(chainId, userId, merchantId, cart, forcedFailure);
    }

    await appendMandate(chainId, "INTENT", { rawAsk: message });

    const loopResult = await deps.runLlmLoop(message);
    if (loopResult.type === "text") {
      return { type: "reply", chainId, text: loopResult.text };
    }

    const skus = [...new Set(loopResult.items.map((i) => i.sku))];
    const productsBySku = await lookupProducts(skus);

    if (forcedFailure === "out_of_stock" && loopResult.items.length > 0) {
      return handleOutOfStockInjection(
        chainId,
        userId,
        merchantId,
        loopResult.items,
        productsBySku,
        consent,
        dayTotalSoFar,
        killSwitchEngaged,
      );
    }

    let built = buildCartMandate(chainId, loopResult.items, productsBySku);
    if (!built.ok) {
      return { type: "reply", chainId, text: `I couldn't complete that: ${built.error}` };
    }

    if (forcedFailure === "cap_breach") {
      built = { ok: true, cart: inflateCartToBreachCap(built.cart, consent.spendCapPerTxn) };
    }

    await appendMandate(chainId, "CART", {
      items: built.cart.items,
      totalInPaise: built.cart.totalInPaise,
      ...(forcedFailure === "cap_breach" ? { forcedFailure, note: "amount inflated by demo header to force STEP_UP" } : {}),
    });

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
    return executeAllowedCart(chainId, userId, merchantId, built.cart, forcedFailure);
  }

  return { handleMessage };
}
