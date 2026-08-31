import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Realistic demo data so a fresh clone of the repo isn't an empty
// shell — run with `npx prisma db seed` after migrating.
async function main() {
  const organization = await prisma.organization.create({ data: { name: "Acme Corp" } });

  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.create({
    data: { email: "demo@acme.com", passwordHash, fullName: "Demo User" }
  });

  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: "ADMIN" }
  });

  await prisma.policy.createMany({
    data: [
      {
        organizationId: organization.id,
        name: "Block credit cards",
        priority: 10,
        action: "BLOCK",
        conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "CREDIT_CARD" }]
      },
      {
        organizationId: organization.id,
        name: "Redact emails",
        priority: 5,
        action: "REDACT",
        conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "EMAIL" }]
      }
    ]
  });

  console.log(`Seeded org ${organization.id} with demo user demo@acme.com / password123`);
}

main().finally(() => prisma.$disconnect());