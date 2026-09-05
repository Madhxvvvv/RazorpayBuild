import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { connectDb, disconnectDb } from "../db/connection.js";
import { Product } from "../db/models/Product.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/agentic-storefront";

const products = [
  { sku: "FOOD-PBAR-001", name: "Peanut Protein Bar", description: "35g peanut protein bar, 12g protein.", priceInPaise: 9900, currency: "INR", category: "food", categoryTags: ["food", "snacks", "protein"], stock: 240, refundWindowDays: 0, maxQtyPerOrder: 10, upsellOf: [] },
  { sku: "FOOD-PBAR-002", name: "Chocolate Protein Bar", description: "35g chocolate protein bar, 12g protein.", priceInPaise: 9900, currency: "INR", category: "food", categoryTags: ["food", "snacks", "protein"], stock: 180, refundWindowDays: 0, maxQtyPerOrder: 10, upsellOf: [] },
  { sku: "FOOD-TRAIL-001", name: "Trail Mix 200g", description: "Nuts, seeds, and dried fruit.", priceInPaise: 24900, currency: "INR", category: "food", categoryTags: ["food", "snacks"], stock: 90, refundWindowDays: 0, maxQtyPerOrder: 5, upsellOf: ["FOOD-PBAR-001", "FOOD-PBAR-002"] },
  { sku: "BEV-WATER-001", name: "Electrolyte Water 500ml", description: "Sugar-free electrolyte drink.", priceInPaise: 4900, currency: "INR", category: "beverages", categoryTags: ["beverages", "food"], stock: 300, refundWindowDays: 0, maxQtyPerOrder: 12, upsellOf: [] },
  { sku: "BEV-COFFEE-001", name: "Cold Brew Coffee 250ml", description: "Unsweetened cold brew.", priceInPaise: 12900, currency: "INR", category: "beverages", categoryTags: ["beverages", "food"], stock: 150, refundWindowDays: 0, maxQtyPerOrder: 12, upsellOf: [] },
  { sku: "GROC-RICE-001", name: "Basmati Rice 1kg", description: "Aged basmati rice.", priceInPaise: 18900, currency: "INR", category: "groceries", categoryTags: ["groceries"], stock: 120, refundWindowDays: 7, maxQtyPerOrder: 6, upsellOf: [] },
  { sku: "GROC-DAL-001", name: "Toor Dal 1kg", description: "Split pigeon peas.", priceInPaise: 15900, currency: "INR", category: "groceries", categoryTags: ["groceries"], stock: 140, refundWindowDays: 7, maxQtyPerOrder: 6, upsellOf: [] },
  { sku: "GROC-OIL-001", name: "Sunflower Oil 1L", description: "Refined sunflower cooking oil.", priceInPaise: 16900, currency: "INR", category: "groceries", categoryTags: ["groceries"], stock: 100, refundWindowDays: 7, maxQtyPerOrder: 4, upsellOf: [] },
  { sku: "GROC-ATTA-001", name: "Whole Wheat Atta 5kg", description: "Stone-ground whole wheat flour.", priceInPaise: 29900, currency: "INR", category: "groceries", categoryTags: ["groceries"], stock: 80, refundWindowDays: 7, maxQtyPerOrder: 3, upsellOf: [] },
  { sku: "PCARE-SOAP-001", name: "Herbal Bath Soap", description: "100g herbal soap bar.", priceInPaise: 6900, currency: "INR", category: "personal-care", categoryTags: ["personal-care"], stock: 200, refundWindowDays: 10, maxQtyPerOrder: 10, upsellOf: [] },
  { sku: "PCARE-SHAMP-001", name: "Anti-Dandruff Shampoo 340ml", description: "Ketoconazole-free anti-dandruff shampoo.", priceInPaise: 21900, currency: "INR", category: "personal-care", categoryTags: ["personal-care"], stock: 90, refundWindowDays: 10, maxQtyPerOrder: 5, upsellOf: ["PCARE-SOAP-001"] },
  { sku: "PCARE-TOOTH-001", name: "Fluoride Toothpaste 150g", description: "Cavity protection toothpaste.", priceInPaise: 9900, currency: "INR", category: "personal-care", categoryTags: ["personal-care"], stock: 220, refundWindowDays: 10, maxQtyPerOrder: 10, upsellOf: [] },
  { sku: "STAT-PEN-001", name: "Gel Pen Pack (5ct)", description: "Smooth-write gel pens, black ink.", priceInPaise: 7900, currency: "INR", category: "stationery", categoryTags: ["stationery"], stock: 300, refundWindowDays: 15, maxQtyPerOrder: 20, upsellOf: [] },
  { sku: "STAT-NOTE-001", name: "Ruled Notebook A5", description: "200-page ruled notebook.", priceInPaise: 12900, currency: "INR", category: "stationery", categoryTags: ["stationery"], stock: 160, refundWindowDays: 15, maxQtyPerOrder: 10, upsellOf: ["STAT-PEN-001"] },
  { sku: "ELEC-CABLE-001", name: "USB-C Cable 1m", description: "Braided fast-charge USB-C cable.", priceInPaise: 34900, currency: "INR", category: "electronics", categoryTags: ["electronics", "accessories"], stock: 70, refundWindowDays: 30, maxQtyPerOrder: 5, upsellOf: [] },
  { sku: "ELEC-EARBUD-001", name: "Wired Earbuds", description: "In-ear wired earbuds with mic.", priceInPaise: 59900, currency: "INR", category: "electronics", categoryTags: ["electronics", "accessories"], stock: 45, refundWindowDays: 30, maxQtyPerOrder: 3, upsellOf: ["ELEC-CABLE-001"] },
  { sku: "ELEC-PWRBANK-001", name: "10000mAh Power Bank", description: "Compact fast-charging power bank.", priceInPaise: 129900, currency: "INR", category: "electronics", categoryTags: ["electronics", "accessories"], stock: 0, refundWindowDays: 30, maxQtyPerOrder: 2, upsellOf: ["ELEC-CABLE-001"] },
  { sku: "FOOD-COOKIE-001", name: "Oatmeal Cookies 150g", description: "Whole-grain oatmeal cookies.", priceInPaise: 8900, currency: "INR", category: "food", categoryTags: ["food", "snacks"], stock: 130, refundWindowDays: 0, maxQtyPerOrder: 10, upsellOf: ["BEV-COFFEE-001"] },
];

async function seed() {
  await connectDb(MONGODB_URI);
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log(`seeded ${products.length} products`);
  await disconnectDb();
}

seed().catch((err) => {
  console.error("seed failed", err);
  process.exit(1);
});
