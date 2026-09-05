import { Product } from "../db/models/Product.js";
import type { AgentMeta, CatalogFeed, SchemaOrgProduct } from "./types.js";

export function toSchemaOrgProduct(p: {
  sku: string;
  name: string;
  description: string;
  priceInPaise: number;
  currency: string;
  category: string;
  stock: number;
  imageUrl?: string | null;
}): SchemaOrgProduct {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    image: p.imageUrl ?? undefined,
    offers: {
      "@type": "Offer",
      price: (p.priceInPaise / 100).toFixed(2),
      priceCurrency: p.currency,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
}

export async function getCatalogFeed(): Promise<CatalogFeed> {
  const products = await Product.find().lean();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.map(toSchemaOrgProduct),
  };
}

export interface CatalogSearchResult {
  sku: string;
  name: string;
  priceInPaise: number;
  category: string;
  stock: number;
}

/** Used by the orchestrator's search_catalog tool — deliberately read-only and narrow. */
export async function searchProducts(query: string, maxPriceInPaise?: number): Promise<CatalogSearchResult[]> {
  const terms = query.split(/\s+/).filter(Boolean);
  const pattern = terms.length > 0 ? terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") : ".*";
  const regex = new RegExp(pattern, "i");

  const filter: Record<string, unknown> = {
    $or: [{ name: regex }, { description: regex }, { category: regex }, { categoryTags: regex }],
  };
  if (typeof maxPriceInPaise === "number") {
    filter.priceInPaise = { $lte: maxPriceInPaise };
  }

  const products = await Product.find(filter).limit(10).lean();
  return products.map((p) => ({
    sku: p.sku,
    name: p.name,
    priceInPaise: p.priceInPaise,
    category: p.category,
    stock: p.stock,
  }));
}

/** Used by the Failure Injector's out_of_stock recovery: find another in-stock item in the same category. */
export async function findInStockAlternative(
  category: string,
  excludeSku: string,
): Promise<CatalogSearchResult | null> {
  const doc = await Product.findOne({ category, sku: { $ne: excludeSku }, stock: { $gt: 0 } }).lean();
  if (!doc) return null;
  return { sku: doc.sku, name: doc.name, priceInPaise: doc.priceInPaise, category: doc.category, stock: doc.stock };
}

export async function getAgentMeta(sku: string): Promise<AgentMeta | null> {
  const product = await Product.findOne({ sku }).lean();
  if (!product) return null;

  return {
    sku: product.sku,
    stock: product.stock,
    refundWindowDays: product.refundWindowDays,
    categoryTags: product.categoryTags,
    maxQtyPerOrder: product.maxQtyPerOrder,
    upsellOf: product.upsellOf,
  };
}
