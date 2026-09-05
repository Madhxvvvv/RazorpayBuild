// Manual verification for Phase 3 (docs/track1-agentic-storefront-architecture.md
// section 5, step 3): exercise the real Razorpay Adapter against test-mode
// APIs, gated behind a hardcoded ALLOW instead of the real Policy Engine, so
// Razorpay integration can be proven independent of the agent/orchestrator.
// The real evaluate() call replaces this stub once Phase 4 wires the
// orchestrator through the Policy Engine to this same adapter.
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createLiveRazorpayClient } from "./razorpay.client.js";
import { createRazorpayAdapter } from "./razorpay.adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const policyStub = { decision: "ALLOW" } as const;

async function main() {
  if (policyStub.decision !== "ALLOW") {
    console.log("blocked by policy stub, nothing to do");
    return;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing from .env.local");
  }

  const adapter = createRazorpayAdapter(createLiveRazorpayClient(keyId, keySecret));

  console.log("--- createOrder ---");
  const order = await adapter.createOrder(9900, "INR", `receipt-${Date.now()}`);
  console.log(order);

  console.log("\n--- createPaymentLink ---");
  const link = await adapter.createPaymentLink(9900, "Peanut Protein Bar x1 (test mode)");
  console.log(link);

  console.log(
    "\ncapturePayment/refund need a real authorized payment id, which only exists after a" +
      "\ncustomer completes checkout in a browser — that step arrives with Phase 4's chat UI." +
      "\nTheir request shape and response mapping are covered by test/razorpay/razorpay.adapter.test.ts.",
  );
}

main().catch((err) => {
  console.error("razorpay live-check failed", err);
  process.exit(1);
});
