import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { registerUser, loginUser } from "./auth.service.js";

const router = Router();

// Zod schemas live inline for now — once `middleware/validate.js` exists
// (Day 4), these move there and get applied as reusable middleware.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1),
  organizationName: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/register", asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  res.status(201).json(result);
}));

router.post("/login", asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  res.status(200).json(result);
}));

export default router;