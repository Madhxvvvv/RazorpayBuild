import { describe, expect, it } from "vitest";
import { buildCartMandate, type CatalogProductLookup } from "../../src/orchestrator/cart-builder.js";

function makeLookup(overrides: Partial<CatalogProductLookup> = {}): CatalogProductLookup {
  return { category: "food", priceInPaise: 9900, maxQtyPerOrder: 10, stock: 5, ...overrides };
}

describe("buildCartMandate", () => {
  it("prices a valid single-item cart", () => {
    const products = new Map([["FOOD-PBAR-001", makeLookup()]]);
    const result = buildCartMandate("chain-1", [{ sku: "FOOD-PBAR-001", qty: 2 }], products);

    expect(result).toEqual({
      ok: true,
      cart: {
        chainId: "chain-1",
        items: [{ sku: "FOOD-PBAR-001", category: "food", qty: 2, unitPriceInPaise: 9900 }],
        totalInPaise: 19800,
      },
    });
  });

  it("sums multiple items", () => {
    const products = new Map([
      ["FOOD-PBAR-001", makeLookup({ priceInPaise: 9900 })],
      ["BEV-WATER-001", makeLookup({ priceInPaise: 4900, category: "beverages" })],
    ]);
    const result = buildCartMandate(
      "chain-1",
      [{ sku: "FOOD-PBAR-001", qty: 1 }, { sku: "BEV-WATER-001", qty: 2 }],
      products,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cart.totalInPaise).toBe(9900 + 4900 * 2);
    }
  });

  it("rejects an empty cart", () => {
    const result = buildCartMandate("chain-1", [], new Map());
    expect(result).toEqual({ ok: false, error: "cart is empty" });
  });

  it("rejects an unknown sku", () => {
    const result = buildCartMandate("chain-1", [{ sku: "NOPE-000", qty: 1 }], new Map());
    expect(result).toEqual({ ok: false, error: "unknown sku: NOPE-000" });
  });

  it("rejects a quantity over the per-order max", () => {
    const products = new Map([["FOOD-PBAR-001", makeLookup({ maxQtyPerOrder: 2 })]]);
    const result = buildCartMandate("chain-1", [{ sku: "FOOD-PBAR-001", qty: 3 }], products);
    expect(result.ok).toBe(false);
  });

  it("rejects a quantity exceeding live stock", () => {
    const products = new Map([["FOOD-PBAR-001", makeLookup({ stock: 1 })]]);
    const result = buildCartMandate("chain-1", [{ sku: "FOOD-PBAR-001", qty: 2 }], products);
    expect(result).toEqual({ ok: false, error: "FOOD-PBAR-001 is out of stock" });
  });
});
