import { Schema, model, type InferSchemaType } from "mongoose";

const mandateSchema = new Schema(
  {
    chainId: { type: String, required: true },
    seq: { type: Number, required: true },
    type: { type: String, required: true, enum: ["INTENT", "CART", "PAYMENT", "EXECUTION"] },
    payload: { type: Schema.Types.Mixed, required: true },
    prevHash: { type: String, required: true },
    hash: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { timestamps: false },
);

mandateSchema.index({ chainId: 1, seq: 1 }, { unique: true });

export type MandateDoc = InferSchemaType<typeof mandateSchema>;
export const Mandate = model("Mandate", mandateSchema);
