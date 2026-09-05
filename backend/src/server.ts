import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { connectDb } from "./db/connection.js";
import { adminRouter } from "./admin/admin.routes.js";
import { catalogRouter } from "./catalog/catalog.routes.js";
import { consentRouter } from "./consent/consent.routes.js";
import { createGroqClient } from "./orchestrator/groq-client.js";
import { runOrchestratorLoop } from "./orchestrator/llm-loop.js";
import { createOrchestrator } from "./orchestrator/orchestrator.js";
import { buildOrchestratorRouter } from "./orchestrator/orchestrator.routes.js";
import { createLiveRazorpayClient } from "./razorpay/razorpay.client.js";
import { createRazorpayAdapter } from "./razorpay/razorpay.adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env.local"), override: true });

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/agentic-storefront";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/catalog", catalogRouter);
app.use("/consent", consentRouter);
app.use("/admin", adminRouter);

async function main() {
  await connectDb(MONGODB_URI);

  const groqApiKey = process.env.GROQ_API_KEY;
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!groqApiKey || !razorpayKeyId || !razorpayKeySecret) {
    throw new Error("GROQ_API_KEY, RAZORPAY_KEY_ID, and RAZORPAY_KEY_SECRET must be set in .env.local");
  }

  const groq = createGroqClient(groqApiKey);
  const razorpayAdapter = createRazorpayAdapter(createLiveRazorpayClient(razorpayKeyId, razorpayKeySecret));
  const orchestrator = createOrchestrator({
    runLlmLoop: (message) => runOrchestratorLoop(groq, GROQ_MODEL, message),
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
