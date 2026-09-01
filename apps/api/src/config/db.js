import { PrismaClient } from "@prisma/client";

// A single shared Prisma instance. Every file that needs the database
// imports THIS, instead of creating its own `new PrismaClient()` —
// creating multiple instances in dev mode leaks connections fast.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

export async function disconnectDb() {
  await prisma.$disconnect();
}