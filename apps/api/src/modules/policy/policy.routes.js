import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import * as policyService from "./policy.service.js";

const router = Router();
router.use(requireAuth);

const conditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.any()
});

const policySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().default(0),
  conditions: z.array(conditionSchema).min(1),
  action: z.string()
});

router.get("/", asyncHandler(async (req, res) => {
  const policies = await policyService.listPolicies(req.auth.organizationId);
  res.json(policies);
}));

router.post(
  "/",
  requirePermission("policies:write"),
  validate(policySchema),
  asyncHandler(async (req, res) => {
    const policy = await policyService.createPolicy(req.auth.organizationId, req.body);
    res.status(201).json(policy);
  })
);

router.patch(
  "/:id",
  requirePermission("policies:write"),
  validate(policySchema.partial()),
  asyncHandler(async (req, res) => {
    const policy = await policyService.updatePolicy(req.auth.organizationId, req.params.id, req.body);
    res.json(policy);
  })
);

router.delete(
  "/:id",
  requirePermission("policies:write"),
  asyncHandler(async (req, res) => {
    await policyService.deletePolicy(req.auth.organizationId, req.params.id);
    res.status(204).send();
  })
);

export default router;