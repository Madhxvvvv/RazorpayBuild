import { Mandate } from "../db/models/Mandate.js";
import { computeHash, verifyChainRecords } from "./hash-chain.js";
import { GENESIS_HASH, type ChainVerificationResult, type MandateRecord, type MandateType } from "./types.js";

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
  return records.map((r) => ({
    chainId: r.chainId,
    seq: r.seq,
    type: r.type,
    payload: r.payload as Record<string, unknown>,
    prevHash: r.prevHash,
    hash: r.hash,
    createdAt: r.createdAt,
  }));
}

export async function verifyChain(chainId: string): Promise<ChainVerificationResult> {
  const records = await getChain(chainId);
  return verifyChainRecords(records);
}
