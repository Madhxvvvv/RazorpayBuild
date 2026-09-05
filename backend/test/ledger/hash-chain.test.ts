import { describe, expect, it } from "vitest";
import { computeHash, verifyChainRecords } from "../../src/ledger/hash-chain.js";
import { GENESIS_HASH, type MandateRecord } from "../../src/ledger/types.js";

const T0 = new Date("2026-09-05T12:00:00.000Z");
const T1 = new Date("2026-09-05T12:00:01.000Z");
const T2 = new Date("2026-09-05T12:00:02.000Z");

function buildValidChain(): MandateRecord[] {
  const intentPayload = { rawAsk: "protein bar under 300 rupees" };
  const intentHash = computeHash(GENESIS_HASH, intentPayload, T0);

  const cartPayload = { items: [{ sku: "FOOD-PBAR-001", qty: 1 }], totalInPaise: 9900 };
  const cartHash = computeHash(intentHash, cartPayload, T1);

  const paymentPayload = { amountInPaise: 9900, instrument: "test-mode" };
  const paymentHash = computeHash(cartHash, paymentPayload, T2);

  return [
    { chainId: "chain-1", seq: 1, type: "INTENT", payload: intentPayload, prevHash: GENESIS_HASH, hash: intentHash, createdAt: T0 },
    { chainId: "chain-1", seq: 2, type: "CART", payload: cartPayload, prevHash: intentHash, hash: cartHash, createdAt: T1 },
    { chainId: "chain-1", seq: 3, type: "PAYMENT", payload: paymentPayload, prevHash: cartHash, hash: paymentHash, createdAt: T2 },
  ];
}

describe("computeHash", () => {
  it("is deterministic for the same prevHash, payload, and createdAt", () => {
    const a = computeHash(GENESIS_HASH, { x: 1 }, T0);
    const b = computeHash(GENESIS_HASH, { x: 1 }, T0);
    expect(a).toBe(b);
  });

  it("changes when the payload changes", () => {
    const a = computeHash(GENESIS_HASH, { x: 1 }, T0);
    const b = computeHash(GENESIS_HASH, { x: 2 }, T0);
    expect(a).not.toBe(b);
  });

  it("changes when prevHash changes", () => {
    const a = computeHash(GENESIS_HASH, { x: 1 }, T0);
    const b = computeHash("some-other-hash", { x: 1 }, T0);
    expect(a).not.toBe(b);
  });
});

describe("verifyChainRecords", () => {
  it("validates an untampered chain", () => {
    const result = verifyChainRecords(buildValidChain());
    expect(result).toEqual({ valid: true, length: 3 });
  });

  it("validates an empty chain", () => {
    const result = verifyChainRecords([]);
    expect(result).toEqual({ valid: true, length: 0 });
  });

  it("detects a payload edited after the fact (hash mismatch)", () => {
    const chain = buildValidChain();
    chain[1].payload = { items: [{ sku: "FOOD-PBAR-001", qty: 99 }], totalInPaise: 9900 };

    const result = verifyChainRecords(chain);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.brokenAtSeq).toBe(2);
      expect(result.reason).toMatch(/hash mismatch/);
    }
  });

  it("detects a record spliced out of the chain (prevHash mismatch)", () => {
    const chain = buildValidChain();
    const withoutCart = [chain[0], chain[2]]; // seq 2 removed, seq 3's prevHash now dangles

    const result = verifyChainRecords(withoutCart);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.brokenAtSeq).toBe(3);
      expect(result.reason).toMatch(/prevHash mismatch/);
    }
  });

  it("detects a chain that doesn't start from GENESIS", () => {
    const chain = buildValidChain();
    chain[0].prevHash = "not-genesis";

    const result = verifyChainRecords(chain);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.brokenAtSeq).toBe(1);
    }
  });
});
