import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { connectDb } from "./db/connection.js";
import { catalogRouter } from "./catalog/catalog.routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env.local") });

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/agentic-storefront";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/catalog", catalogRouter);

async function main() {
  await connectDb(MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("failed to start server", err);
  process.exit(1);
});
