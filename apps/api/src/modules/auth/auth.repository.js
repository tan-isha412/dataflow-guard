import { prisma } from "../../config/db.js";

// The repository is the ONLY layer allowed to talk to Prisma directly.
// auth.service.js will call these functions instead of importing
// `prisma` itself — that way, if you ever swap databases, only this
// file changes.
export function findUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserWithMemberships(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { organization: true } } }
  });
}

export async function createUserWithOrganization({ email, passwordHash, fullName, organizationName }) {
  // A transaction: either all three rows get created, or none do.
  // Without this, a crash between steps could leave a user with no org.
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: organizationName }
    });

    const user = await tx.user.create({
      data: { email, passwordHash, fullName }
    });

    const membership = await tx.membership.create({
      data: { userId: user.id, organizationId: organization.id, role: "ADMIN" }
    });

    return { user, organization, membership };
  });
}