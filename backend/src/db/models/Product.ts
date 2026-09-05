import { Schema, model, type InferSchemaType } from "mongoose";

const productSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    priceInPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "INR" },
    category: { type: String, required: true },
    categoryTags: { type: [String], required: true, default: [] },
    stock: { type: Number, required: true, min: 0 },
    refundWindowDays: { type: Number, required: true, min: 0 },
    maxQtyPerOrder: { type: Number, required: true, min: 1 },
    upsellOf: { type: [String], required: true, default: [] },
    imageUrl: { type: String },
  },
  { timestamps: true },
);

export type ProductDoc = InferSchemaType<typeof productSchema>;
export const Product = model("Product", productSchema);
