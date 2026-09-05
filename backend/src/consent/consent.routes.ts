import { Router } from "express";
import { asyncHandler } from "../async-handler.js";
import { getConsent, revokeConsent, upsertConsent } from "./consent.service.js";

export const consentRouter = Router();

consentRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { userId, merchantId, spendCapPerTxn, spendCapPerDay, categoryAllowlist, expiresAt } = req.body ?? {};
    if (!userId || !merchantId || !spendCapPerTxn || !spendCapPerDay || !Array.isArray(categoryAllowlist) || !expiresAt) {
      res.status(400).json({
        error: "userId, merchantId, spendCapPerTxn, spendCapPerDay, categoryAllowlist[], expiresAt are all required",
      });
      return;
    }

    const consent = await upsertConsent({
      userId,
      merchantId,
      spendCapPerTxn: Number(spendCapPerTxn),
      spendCapPerDay: Number(spendCapPerDay),
      categoryAllowlist,
      expiresAt: new Date(expiresAt),
    });
    res.status(201).json(consent);
  }),
);

consentRouter.get(
  "/:userId/:merchantId",
  asyncHandler(async (req, res) => {
    const consent = await getConsent(req.params.userId, req.params.merchantId);
    if (!consent) {
      res.status(404).json({ error: "no consent on file for this user/merchant pair" });
      return;
    }
    res.json(consent);
  }),
);

consentRouter.post(
  "/revoke",
  asyncHandler(async (req, res) => {
    const { userId, merchantId } = req.body ?? {};
    if (!userId || !merchantId) {
      res.status(400).json({ error: "userId and merchantId are required" });
      return;
    }

    const consent = await revokeConsent(userId, merchantId);
    if (!consent) {
      res.status(404).json({ error: "no consent on file for this user/merchant pair" });
      return;
    }
    res.json(consent);
  }),
);
