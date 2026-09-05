import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { connectDb, disconnectDb } from "../db/connection.js";
import { verifyChain } from "./ledger.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local"), override: true });

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/agentic-storefront";

async function main() {
  const chainId = process.argv[2];
  if (!chainId) {
    console.error("usage: npm run verify-chain -- <chainId>");
    process.exit(1);
  }

  await connectDb(MONGODB_URI);
  const result = await verifyChain(chainId);
  await disconnectDb();

  if (result.valid) {
    console.log(`chain "${chainId}" is intact — ${result.length} record(s), hashes verified in order.`);
    process.exit(0);
  }

  console.error(`chain "${chainId}" is BROKEN at seq ${result.brokenAtSeq}: ${result.reason}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("verify-chain failed", err);
  process.exit(1);
});
