import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import * as approvalsService from "./approvals.service.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const approvals = await approvalsService.listApprovals(req.auth.organizationId, { status: req.query.status });
  res.json(approvals);
}));

router.patch(
  "/:id/decide",
  requirePermission("approvals:decide"),
  validate(z.object({ decision: z.enum(["APPROVED", "REJECTED"]) })),
  asyncHandler(async (req, res) => {
    const approval = await approvalsService.decideApproval(
      req.auth.organizationId, req.params.id, req.body.decision, req.auth.userId
    );
    res.json(approval);
  })
);

export default router;