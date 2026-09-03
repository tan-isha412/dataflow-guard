import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { runInspection } from "./inspect.service.js";

const router = Router();

const inspectSchema = z.object({
  content: z.string().min(1),
  // Kept backward compatible with earlier extension builds that only
  // sent a bare destinationId; destinationType/displayName are optional
  // enrichment the adapter already knows (see Phase 7 destination
  // awareness) — never anything the client's word alone is trusted for
  // (risk/type are RE-DERIVED server-side in destinations.service.js).
  destinationId: z.string().min(1).optional(),
  destinationType: z.string().optional(),
  displayName: z.string().optional()
});

router.post(
  "/",
  requireAuth,
  requirePermission("inspect:run"),
  validate(inspectSchema),
  asyncHandler(async (req, res) => {
    const decision = await runInspection({
      organizationId: req.auth.organizationId,
      requestedByUserId: req.auth.userId,
      userRole: req.auth.role,
      content: req.body.content,
      destination: req.body.destinationId
        ? { destinationId: req.body.destinationId, destinationType: req.body.destinationType, displayName: req.body.displayName }
        : null,
      requestId: req.id
    });
    res.json(decision);
  })
);

export default router;