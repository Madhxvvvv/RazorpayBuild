import type { CartItem, CartMandate } from "../policy/types.js";
import type { ProposedCartItem } from "./types.js";

export interface CatalogProductLookup {
  category: string;
  priceInPaise: number;
  maxQtyPerOrder: number;
  stock: number;
}

export type BuildCartResult = { ok: true; cart: CartMandate } | { ok: false; error: string };

/**
 * Pure: turns the LLM's proposed {sku, qty}[] into a priced CartMandate, or
 * an error if a SKU is unknown, over the per-order max, or out of stock.
 * Takes the product lookups as a plain map so it doesn't need a DB to test.
 */
export function buildCartMandate(
  chainId: string,
  items: ProposedCartItem[],
  productsBySku: Map<string, CatalogProductLookup>,
): BuildCartResult {
  if (items.length === 0) {
    return { ok: false, error: "cart is empty" };
  }

  const cartItems: CartItem[] = [];

  for (const item of items) {
    const product = productsBySku.get(item.sku);
    if (!product) {
      return { ok: false, error: `unknown sku: ${item.sku}` };
    }
    if (item.qty < 1) {
      return { ok: false, error: `invalid quantity for ${item.sku}` };
    }
    if (item.qty > product.maxQtyPerOrder) {
      return { ok: false, error: `${item.sku}: max ${product.maxQtyPerOrder} per order, requested ${item.qty}` };
    }
    if (item.qty > product.stock) {
      return { ok: false, error: `${item.sku} is out of stock` };
    }
    cartItems.push({
      sku: item.sku,
      category: product.category,
      qty: item.qty,
      unitPriceInPaise: product.priceInPaise,
    });
  }

  const totalInPaise = cartItems.reduce((sum, i) => sum + i.unitPriceInPaise * i.qty, 0);
  return { ok: true, cart: { chainId, items: cartItems, totalInPaise } };
}

/**
 * Failure-injector helper (cap_breach mode): scales every item's unit price
 * up proportionally so the cart's total lands just over the per-transaction
 * cap, guaranteeing a STEP_UP regardless of which item was actually chosen.
 * Scaling proportionally (not just overwriting the total) keeps the ledger's
 * CART record internally consistent — items × qty still equals the total.
 */
export function inflateCartToBreachCap(cart: CartMandate, spendCapPerTxn: number): CartMandate {
  const targetTotal = spendCapPerTxn + 10000; // comfortably over the cap, in paise
  const scale = targetTotal / cart.totalInPaise;
  const items = cart.items.map((item) => ({ ...item, unitPriceInPaise: Math.round(item.unitPriceInPaise * scale) }));
  const totalInPaise = items.reduce((sum, item) => sum + item.unitPriceInPaise * item.qty, 0);
  return { ...cart, items, totalInPaise };
}
