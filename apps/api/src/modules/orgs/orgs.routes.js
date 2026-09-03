import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { getOrganization, listMembers, renameOrganization, updatePrivacySettings } from "./orgs.service.js";
import { inviteMember, changeMemberRole } from "./membership.service.js";

const router = Router();

// Every route below runs requireAuth first — req.auth.organizationId
// always comes from the JWT, never from the URL or body, so a user
// can never act on an org they don't belong to.
router.use(requireAuth);

router.get("/me", asyncHandler(async (req, res) => {
  const org = await getOrganization(req.auth.organizationId);
  res.json(org);
}));

router.get("/members", asyncHandler(async (req, res) => {
  const members = await listMembers(req.auth.organizationId);
  res.json(members);
}));

router.patch(
  "/me",
  requirePermission("org:manage"),
  validate(z.object({ name: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const org = await renameOrganization(req.auth.organizationId, req.body.name);
    res.json(org);
  })
);

router.patch(
  "/me/privacy-settings",
  requirePermission("org:manage"),
  validate(z.object({ auditRetentionDays: z.number().int().min(1).max(3650).nullable() })),
  asyncHandler(async (req, res) => {
    const org = await updatePrivacySettings(req.auth.organizationId, req.body);
    res.json(org);
  })
);

router.post(
  "/members/invite",
  requirePermission("users:manage"),
  validate(z.object({ email: z.string().email(), role: z.string() })),
  asyncHandler(async (req, res) => {
    const membership = await inviteMember({
      organizationId: req.auth.organizationId,
      email: req.body.email,
      role: req.body.role
    });
    res.status(201).json(membership);
  })
);

router.patch(
  "/members/:userId/role",
  requirePermission("users:manage"),
  validate(z.object({ role: z.string() })),
  asyncHandler(async (req, res) => {
    const membership = await changeMemberRole({
      organizationId: req.auth.organizationId,
      userId: req.params.userId,
      newRole: req.body.role
    });
    res.json(membership);
  })
);

export default router;