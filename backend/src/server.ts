import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { connectDb } from "./db/connection.js";
import { catalogRouter } from "./catalog/catalog.routes.js";
import { consentRouter } from "./consent/consent.routes.js";
import { createOpenAiClient } from "./orchestrator/openai-client.js";
import { runOrchestratorLoop } from "./orchestrator/llm-loop.js";
import { createOrchestrator } from "./orchestrator/orchestrator.js";
import { buildOrchestratorRouter } from "./orchestrator/orchestrator.routes.js";
import { createLiveRazorpayClient } from "./razorpay/razorpay.client.js";
import { createRazorpayAdapter } from "./razorpay/razorpay.adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env.local") });

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/agentic-storefront";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/catalog", catalogRouter);
app.use("/consent", consentRouter);

async function main() {
  await connectDb(MONGODB_URI);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!openaiApiKey || !razorpayKeyId || !razorpayKeySecret) {
    throw new Error("OPENAI_API_KEY, RAZORPAY_KEY_ID, and RAZORPAY_KEY_SECRET must be set in .env.local");
  }

  const openai = createOpenAiClient(openaiApiKey);
  const razorpayAdapter = createRazorpayAdapter(createLiveRazorpayClient(razorpayKeyId, razorpayKeySecret));
  const orchestrator = createOrchestrator({
    runLlmLoop: (message) => runOrchestratorLoop(openai, OPENAI_MODEL, message),
    razorpayAdapter,
  });

  app.use("/orchestrator", buildOrchestratorRouter(orchestrator));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : "internal server error" });
  });

  app.listen(PORT, () => {
    console.log(`backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("failed to start server", err);
  process.exit(1);
});
