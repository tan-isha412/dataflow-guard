import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { getRiskOverTime, getDetectionsByType } from "./analytics.service.js";

const router = Router();
router.use(requireAuth);

router.get("/risk-over-time", asyncHandler(async (req, res) => {
  const data = await getRiskOverTime(req.auth.organizationId, Number(req.query.days) || 30);
  res.json(data);
}));

router.get("/detections-by-type", asyncHandler(async (req, res) => {
  const data = await getDetectionsByType(req.auth.organizationId);
  res.json(data);
}));

export default router;