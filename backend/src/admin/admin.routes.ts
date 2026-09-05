import { Router } from "express";
import { asyncHandler } from "../async-handler.js";
import { getChain, listRecentChains, listRecentExecutions, verifyChain } from "../ledger/ledger.service.js";
import { disengage, engage, isEngaged } from "../policy/kill-switch.js";

export const adminRouter = Router();

adminRouter.get(
  "/chains",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    const chains = await listRecentChains(limit);
    res.json(chains);
  }),
);

adminRouter.get(
  "/chains/:chainId",
  asyncHandler(async (req, res) => {
    const records = await getChain(req.params.chainId);
    if (records.length === 0) {
      res.status(404).json({ error: `no mandates found for chain ${req.params.chainId}` });
      return;
    }
    const verification = await verifyChain(req.params.chainId);
    res.json({ records, verification });
  }),
);

adminRouter.get(
  "/decisions",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    const decisions = await listRecentExecutions(limit);
    res.json(decisions);
  }),
);

adminRouter.get(
  "/kill-switch/:merchantId",
  asyncHandler(async (req, res) => {
    res.json({ merchantId: req.params.merchantId, engaged: isEngaged(req.params.merchantId) });
  }),
);

adminRouter.post(
  "/kill-switch",
  asyncHandler(async (req, res) => {
    const { merchantId, engaged } = req.body ?? {};
    if (!merchantId || typeof engaged !== "boolean") {
      res.status(400).json({ error: "merchantId (string) and engaged (boolean) are required" });
      return;
    }
    if (engaged) {
      engage(merchantId);
    } else {
      disengage(merchantId);
    }
    res.json({ merchantId, engaged: isEngaged(merchantId) });
  }),
);
