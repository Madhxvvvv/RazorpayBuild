import { Router } from "express";
import { getAgentMeta, getCatalogFeed } from "./catalog.service.js";

export const catalogRouter = Router();

catalogRouter.get("/feed.json", async (_req, res) => {
  const feed = await getCatalogFeed();
  res.json(feed);
});

catalogRouter.get("/agent-meta/:sku", async (req, res) => {
  const meta = await getAgentMeta(req.params.sku);
  if (!meta) {
    res.status(404).json({ error: `no product with sku ${req.params.sku}` });
    return;
  }
  res.json(meta);
});
