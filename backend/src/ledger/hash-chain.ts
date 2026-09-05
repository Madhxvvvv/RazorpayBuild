import { createHash } from "node:crypto";
import { GENESIS_HASH, type ChainVerificationResult, type MandateRecord } from "./types.js";

/** sha256(prevHash + JSON.stringify(payload) + createdAt), per section 3.4. */
export function computeHash(
  prevHash: string,
  payload: Record<string, unknown>,
  createdAt: Date,
): string {
  return createHash("sha256")
    .update(prevHash + JSON.stringify(payload) + createdAt.toISOString())
    .digest("hex");
}

/**
 * Pure verification over an in-memory list of records, ordered by seq
 * ascending. No DB access — the Mongo-backed verifyChain() in
 * ledger.service.ts just loads a chain and hands it to this.
 */
export function verifyChainRecords(records: MandateRecord[]): ChainVerificationResult {
  let expectedPrevHash = GENESIS_HASH;

  for (const record of records) {
    if (record.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        brokenAtSeq: record.seq,
        reason: `prevHash mismatch: expected ${expectedPrevHash}, found ${record.prevHash}`,
      };
    }

    const recomputed = computeHash(record.prevHash, record.payload, record.createdAt);
    if (recomputed !== record.hash) {
      return {
        valid: false,
        brokenAtSeq: record.seq,
        reason: `hash mismatch: record has been tampered with`,
      };
    }

    expectedPrevHash = record.hash;
  }

  return { valid: true, length: records.length };
}
