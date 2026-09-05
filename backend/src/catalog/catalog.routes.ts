import { Router } from "express";
import { asyncHandler } from "../async-handler.js";
import { getAgentMeta, getCatalogFeed } from "./catalog.service.js";

export const catalogRouter = Router();

catalogRouter.get(
  "/feed.json",
  asyncHandler(async (_req, res) => {
    const feed = await getCatalogFeed();
    res.json(feed);
  }),
);

catalogRouter.get(
  "/agent-meta/:sku",
  asyncHandler(async (req, res) => {
    const meta = await getAgentMeta(req.params.sku);
    if (!meta) {
      res.status(404).json({ error: `no product with sku ${req.params.sku}` });
      return;
    }
    res.json(meta);
  }),
);
