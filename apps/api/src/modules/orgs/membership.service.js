import { AppError } from "../../middleware/errorHandler.js";
import { prisma } from "../../config/db.js";
import { isValidRole } from "@dataflow-guardian/shared";
import { findUserByEmail } from "../auth/auth.repository.js";

// Invites an EXISTING user into an org with a given role. (Inviting
// someone with no account yet is a Phase-6-notifications concern —
// out of scope until Day 19.)
export async function inviteMember({ organizationId, email, role }) {
  if (!isValidRole(role)) {
    throw new AppError(`Invalid role: ${role}`, 400, "INVALID_ROLE");
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError("No account found for that email", 404, "USER_NOT_FOUND");
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } }
  });
  if (existing) {
    throw new AppError("User is already a member of this organization", 409, "ALREADY_MEMBER");
  }

  return prisma.membership.create({
    data: { userId: user.id, organizationId, role }
  });
}

export async function changeMemberRole({ organizationId, userId, newRole }) {
  if (!isValidRole(newRole)) {
    throw new AppError(`Invalid role: ${newRole}`, 400, "INVALID_ROLE");
  }

  return prisma.membership.update({
    where: { userId_organizationId: { userId, organizationId } },
    data: { role: newRole }
  });
}