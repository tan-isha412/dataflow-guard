import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { getCurrentUser, updateCurrentUser } from "./users.service.js";

const router = Router();
router.use(requireAuth);

router.get("/me", asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.auth.userId);
  res.json(user);
}));

router.patch(
  "/me",
  validate(z.object({ fullName: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const user = await updateCurrentUser(req.auth.userId, req.body);
    res.json(user);
  })
);

export default router;