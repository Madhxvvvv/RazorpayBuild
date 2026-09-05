import { describe, expect, it } from "vitest";
import { toSchemaOrgProduct } from "../../src/catalog/catalog.service.js";

describe("toSchemaOrgProduct", () => {
  const base = {
    sku: "FOOD-PBAR-001",
    name: "Peanut Protein Bar",
    description: "35g peanut protein bar, 12g protein.",
    priceInPaise: 9900,
    currency: "INR",
    category: "food",
    stock: 10,
  };

  it("converts paise to a decimal rupee string", () => {
    const result = toSchemaOrgProduct(base);
    expect(result.offers.price).toBe("99.00");
    expect(result.offers.priceCurrency).toBe("INR");
  });

  it("marks in-stock items as InStock", () => {
    const result = toSchemaOrgProduct({ ...base, stock: 5 });
    expect(result.offers.availability).toBe("https://schema.org/InStock");
  });

  it("marks zero-stock items as OutOfStock", () => {
    const result = toSchemaOrgProduct({ ...base, stock: 0 });
    expect(result.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("preserves schema.org JSON-LD shape", () => {
    const result = toSchemaOrgProduct(base);
    expect(result["@context"]).toBe("https://schema.org");
    expect(result["@type"]).toBe("Product");
    expect(result.sku).toBe(base.sku);
  });
});
