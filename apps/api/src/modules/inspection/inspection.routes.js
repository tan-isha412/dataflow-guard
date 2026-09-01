import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { detectSensitiveData } from "./inspection.service.js";

const router = Router();
router.use(requireAuth);

router.post(
  "/scan",
  requirePermission("inspect:run"),
  validate(z.object({ content: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const detections = detectSensitiveData(req.body.content);
    res.json({ detections });
  })
);

export default router;