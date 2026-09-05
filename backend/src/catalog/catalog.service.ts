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
