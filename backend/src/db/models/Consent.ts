import { Schema, model, type InferSchemaType } from "mongoose";

const consentSchema = new Schema(
  {
    userId: { type: String, required: true },
    merchantId: { type: String, required: true },
    spendCapPerTxn: { type: Number, required: true, min: 0 },
    spendCapPerDay: { type: Number, required: true, min: 0 },
    categoryAllowlist: { type: [String], required: true, default: [] },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

consentSchema.index({ userId: 1, merchantId: 1 }, { unique: true });

export type ConsentDoc = InferSchemaType<typeof consentSchema>;
export const ConsentModel = model("Consent", consentSchema);
