import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { listAuditEvents, getDashboardSummary } from "./audit.service.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const events = await listAuditEvents(req.auth.organizationId, {
    skip: Number(req.query.skip) || 0,
    take: Number(req.query.take) || 50,
    eventType: req.query.eventType
  });
  res.json(events);
}));

router.get("/summary", asyncHandler(async (req, res) => {
  const summary = await getDashboardSummary(req.auth.organizationId);
  res.json(summary);
}));

export default router;