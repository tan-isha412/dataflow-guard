import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { runInspection } from "./inspect.service.js";

const router = Router();

router.post(
  "/",
  requireAuth,
  requirePermission("inspect:run"),
  validate(z.object({ content: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const decision = await runInspection({
      organizationId: req.auth.organizationId,
      content: req.body.content
    });
    res.json(decision);
  })
);

export default router;