import { ConsentModel } from "../db/models/Consent.js";
import type { Consent } from "../policy/types.js";

export interface UpsertConsentInput {
  userId: string;
  merchantId: string;
  spendCapPerTxn: number;
  spendCapPerDay: number;
  categoryAllowlist: string[];
  expiresAt: Date;
}

export async function upsertConsent(input: UpsertConsentInput): Promise<Consent> {
  const doc = await ConsentModel.findOneAndUpdate(
    { userId: input.userId, merchantId: input.merchantId },
    { ...input, revoked: false },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return toConsent(doc);
}

export async function getConsent(userId: string, merchantId: string): Promise<Consent | null> {
  const doc = await ConsentModel.findOne({ userId, merchantId }).lean();
  return doc ? toConsent(doc) : null;
}

export async function revokeConsent(userId: string, merchantId: string): Promise<Consent | null> {
  const doc = await ConsentModel.findOneAndUpdate(
    { userId, merchantId },
    { revoked: true },
    { new: true },
  ).lean();
  return doc ? toConsent(doc) : null;
}

function toConsent(doc: {
  userId: string;
  merchantId: string;
  spendCapPerTxn: number;
  spendCapPerDay: number;
  categoryAllowlist: string[];
  expiresAt: Date;
  revoked: boolean;
}): Consent {
  return {
    userId: doc.userId,
    merchantId: doc.merchantId,
    spendCapPerTxn: doc.spendCapPerTxn,
    spendCapPerDay: doc.spendCapPerDay,
    categoryAllowlist: doc.categoryAllowlist,
    expiresAt: doc.expiresAt,
    revoked: doc.revoked,
  };
}
