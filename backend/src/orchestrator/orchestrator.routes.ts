import { Router } from "express";
import { asyncHandler } from "../async-handler.js";
import { parseFailureMode } from "./failure-injector.js";
import type { createOrchestrator } from "./orchestrator.js";

export function buildOrchestratorRouter(orchestrator: ReturnType<typeof createOrchestrator>): Router {
  const router = Router();

  router.post(
    "/message",
    asyncHandler(async (req, res) => {
      const { userId, merchantId, chainId, message, confirmStepUp } = req.body ?? {};
      if (!userId || !merchantId || !message) {
        res.status(400).json({ error: "userId, merchantId, and message are required" });
        return;
      }

      const result = await orchestrator.handleMessage({
        userId,
        merchantId,
        chainId,
        message,
        confirmStepUp: Boolean(confirmStepUp),
        forcedFailure: parseFailureMode(req.header("X-Force-Failure")),
      });
      res.json(result);
    }),
  );

  return router;
}
