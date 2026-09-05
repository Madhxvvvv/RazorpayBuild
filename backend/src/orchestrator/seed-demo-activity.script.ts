// One-time demo-data seeder: generates a realistic mix of purchase sessions
// (allowed, denied, step-up-pending, decline-recovery, out-of-stock
// substitution) against the REAL Mongo + REAL test-mode Razorpay, using a
// stub LLM loop (OPENAI_API_KEY isn't wired to a real key yet). Unlike the
// throwaway smoke-test scripts from earlier phases, this data is meant to
// stay — it's what makes the redesigned Admin Dashboard demo-ready instead
// of an empty shell. Safe to re-run; it only adds new chains.
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { connectDb, disconnectDb } from "../db/connection.js";
import { upsertConsent } from "../consent/consent.service.js";
import { createLiveRazorpayClient } from "../razorpay/razorpay.client.js";
import { createRazorpayAdapter } from "../razorpay/razorpay.adapter.js";
import { createOrchestrator } from "./orchestrator.js";
import type { LlmLoopResult } from "./llm-loop.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const USER_ID = "user-1";
const MERCHANT_ID = "merchant-1";

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/agentic-storefront";
  await connectDb(MONGODB_URI);

  await upsertConsent({
    userId: USER_ID,
    merchantId: MERCHANT_ID,
    spendCapPerTxn: 50000,
    spendCapPerDay: 300000,
    categoryAllowlist: ["food", "beverages", "groceries"],
    expiresAt: new Date("2026-12-31"),
  });

  const razorpayAdapter = createRazorpayAdapter(
    createLiveRazorpayClient(process.env.RAZORPAY_KEY_ID!, process.env.RAZORPAY_KEY_SECRET!),
  );

  const stub = (items: Array<{ sku: string; qty: number }>) => async (): Promise<LlmLoopResult> => ({
    type: "propose_cart",
    items,
  });

  console.log("1/5 allowed purchase (protein bar)...");
  const orch1 = createOrchestrator({ runLlmLoop: stub([{ sku: "FOOD-PBAR-001", qty: 1 }]), razorpayAdapter });
  console.log(await orch1.handleMessage({ userId: USER_ID, merchantId: MERCHANT_ID, message: "order me a protein bar under 300 rupees" }));

  console.log("2/5 denied purchase (category not allowed: electronics)...");
  const orch2 = createOrchestrator({ runLlmLoop: stub([{ sku: "ELEC-CABLE-001", qty: 1 }]), razorpayAdapter });
  console.log(await orch2.handleMessage({ userId: USER_ID, merchantId: MERCHANT_ID, message: "get me a usb-c cable" }));

  console.log("3/5 step-up pending (large grocery order, left unconfirmed)...");
  const orch3 = createOrchestrator({ runLlmLoop: stub([{ sku: "GROC-ATTA-001", qty: 2 }]), razorpayAdapter });
  console.log(await orch3.handleMessage({ userId: USER_ID, merchantId: MERCHANT_ID, message: "order 2 bags of atta" }));

  console.log("4/5 decline then automatic recovery...");
  const orch4 = createOrchestrator({ runLlmLoop: stub([{ sku: "BEV-COFFEE-001", qty: 1 }]), razorpayAdapter });
  console.log(
    await orch4.handleMessage({
      userId: USER_ID,
      merchantId: MERCHANT_ID,
      message: "get me a cold brew coffee",
      forcedFailure: "decline",
    }),
  );

  console.log("5/5 out of stock, substituted automatically...");
  const orch5 = createOrchestrator({ runLlmLoop: stub([{ sku: "FOOD-COOKIE-001", qty: 1 }]), razorpayAdapter });
  console.log(
    await orch5.handleMessage({
      userId: USER_ID,
      merchantId: MERCHANT_ID,
      message: "order some oatmeal cookies",
      forcedFailure: "out_of_stock",
    }),
  );

  await disconnectDb();
  console.log("\ndone — demo activity seeded, left in place for the dashboard.");
}

main().catch((err) => {
  console.error("seed-demo-activity failed", err);
  process.exit(1);
});
