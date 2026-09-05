import { AppError } from "../../middleware/errorHandler.js";
import { prisma } from "../../config/db.js";
import { isValidRole, ROLES } from "@dataflow-guardian/shared";
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

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } }
  });
  if (!membership) {
    throw new AppError("That user is not a member of this organization", 404, "MEMBER_NOT_FOUND");
  }

  // An org must always retain at least one ADMIN — otherwise nobody
  // could ever again manage members/policies/destinations for it (no
  // account-recovery path exists, see docs/security.md). This guards
  // both an admin demoting themselves and one demoting the last other
  // admin; it does NOT limit how many admins an org can have, only
  // that it can never go to zero.
  if (membership.role === ROLES.ADMIN && newRole !== ROLES.ADMIN) {
    const remainingAdmins = await prisma.membership.count({
      where: { organizationId, role: ROLES.ADMIN, userId: { not: userId } }
    });
    if (remainingAdmins === 0) {
      throw new AppError(
        "Cannot change this member's role — every organization must keep at least one administrator",
        409,
        "LAST_ADMIN"
      );
    }
  }

  return prisma.membership.update({
    where: { userId_organizationId: { userId, organizationId } },
    data: { role: newRole }
  });
}