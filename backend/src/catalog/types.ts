// AgentMeta matches docs/track1-agentic-storefront-architecture.md section 3.2 exactly.
export interface AgentMeta {
  sku: string;
  stock: number;
  refundWindowDays: number;
  categoryTags: string[];
  maxQtyPerOrder: number;
  upsellOf: string[];
}

export interface SchemaOrgOffer {
  "@type": "Offer";
  price: string;
  priceCurrency: string;
  availability: "https://schema.org/InStock" | "https://schema.org/OutOfStock";
}

export interface SchemaOrgProduct {
  "@context": "https://schema.org";
  "@type": "Product";
  sku: string;
  name: string;
  description: string;
  category: string;
  image?: string;
  offers: SchemaOrgOffer;
}

export interface CatalogFeed {
  "@context": "https://schema.org";
  "@type": "ItemList";
  itemListElement: SchemaOrgProduct[];
}
