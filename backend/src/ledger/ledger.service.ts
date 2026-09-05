import { Mandate } from "../db/models/Mandate.js";
import { computeHash, verifyChainRecords } from "./hash-chain.js";
import { GENESIS_HASH, type ChainVerificationResult, type MandateRecord, type MandateType } from "./types.js";

function toMandateRecord(r: {
  chainId: string;
  seq: number;
  type: MandateType;
  payload: unknown;
  prevHash: string;
  hash: string;
  createdAt: Date;
}): MandateRecord {
  return {
    chainId: r.chainId,
    seq: r.seq,
    type: r.type,
    payload: r.payload as Record<string, unknown>,
    prevHash: r.prevHash,
    hash: r.hash,
    createdAt: r.createdAt,
  };
}

export async function appendMandate(
  chainId: string,
  type: MandateType,
  payload: Record<string, unknown>,
): Promise<MandateRecord> {
  const last = await Mandate.findOne({ chainId }).sort({ seq: -1 }).lean();
  const prevHash = last?.hash ?? GENESIS_HASH;
  const seq = (last?.seq ?? 0) + 1;
  const createdAt = new Date();
  const hash = computeHash(prevHash, payload, createdAt);

  const record = { chainId, seq, type, payload, prevHash, hash, createdAt };
  await Mandate.create(record);
  return record;
}

export async function getChain(chainId: string): Promise<MandateRecord[]> {
  const records = await Mandate.find({ chainId }).sort({ seq: 1 }).lean();
  return records.map(toMandateRecord);
}

export async function verifyChain(chainId: string): Promise<ChainVerificationResult> {
  const records = await getChain(chainId);
  return verifyChainRecords(records);
}

export interface ChainSummary {
  chainId: string;
  recordCount: number;
  lastActivityAt: Date;
  lastType: MandateType;
  lastResult?: unknown;
  rawAsk?: string;
}

/** Used by the Admin Dashboard's ledger table — one row per purchase session, newest first. */
export async function listRecentChains(limit = 50): Promise<ChainSummary[]> {
  const groups = await Mandate.aggregate<{
    _id: string;
    recordCount: number;
    lastActivityAt: Date;
    records: Array<{ type: MandateType; payload: Record<string, unknown>; createdAt: Date }>;
  }>([
    { $sort: { chainId: 1, seq: 1 } },
    {
      $group: {
        _id: "$chainId",
        recordCount: { $sum: 1 },
        lastActivityAt: { $max: "$createdAt" },
        records: { $push: { type: "$type", payload: "$payload", createdAt: "$createdAt" } },
      },
    },
    { $sort: { lastActivityAt: -1 } },
    { $limit: limit },
  ]);

  return groups.map((g) => {
    const first = g.records[0];
    const last = g.records[g.records.length - 1];
    return {
      chainId: g._id,
      recordCount: g.recordCount,
      lastActivityAt: g.lastActivityAt,
      lastType: last.type,
      lastResult: last.payload?.result ?? last.payload?.reason,
      rawAsk: first?.type === "INTENT" ? (first.payload?.rawAsk as string | undefined) : undefined,
    };
  });
}

/** Used by the Admin Dashboard's policy-decision feed — every EXECUTION record (allowed or blocked), newest first. */
export async function listRecentExecutions(limit = 50): Promise<MandateRecord[]> {
  const records = await Mandate.find({ type: "EXECUTION" }).sort({ createdAt: -1 }).limit(limit).lean();
  return records.map(toMandateRecord);
}
