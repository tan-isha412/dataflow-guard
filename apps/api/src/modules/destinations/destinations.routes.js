import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import * as destinationsService from "./destinations.service.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const destinations = await destinationsService.listDestinations(req.auth.organizationId);
  res.json(destinations);
}));

router.post(
  "/",
  requirePermission("destinations:write"),
  validate(z.object({
    name: z.string().min(1),
    type: z.string(),
    baseUrl: z.string().url().optional(),
    allowedDataTypes: z.array(z.string()).default([])
  })),
  asyncHandler(async (req, res) => {
    const destination = await destinationsService.createDestination(req.auth.organizationId, req.body);
    res.status(201).json(destination);
  })
);

router.patch(
  "/:id/status",
  requirePermission("destinations:write"),
  validate(z.object({ status: z.string() })),
  asyncHandler(async (req, res) => {
    const destination = await destinationsService.updateDestinationStatus(
      req.auth.organizationId, req.params.id, req.body.status
    );
    res.json(destination);
  })
);

export default router;