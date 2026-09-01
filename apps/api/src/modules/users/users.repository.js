import { prisma } from "../../config/db.js";

export function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, fullName: true, createdAt: true }
  });
}

export function updateUserProfile(id, { fullName }) {
  return prisma.user.update({
    where: { id },
    data: { fullName },
    select: { id: true, email: true, fullName: true }
  });
}