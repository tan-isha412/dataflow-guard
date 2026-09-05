import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ============================================================
// DEVELOPMENT / DEMO DATA ONLY — never run against a production
// database. Every value below is synthetic: fake org, fake users,
// fake password, fake "sensitive" values used only to demonstrate
// detection (a real credit card number and AWS key format, but not
// live/functional credentials of any kind). Matches the demo walk-
// through in README.md's "Demo script" section exactly, so seeding
// this and following that script exercises real ALLOW/BLOCK/REDACT/
// REQUIRE_APPROVAL behavior end to end with zero manual setup.
// Run with `npx prisma db seed` after migrating.
// ============================================================
async function main() {
  const organization = await prisma.organization.create({ data: { name: "Acme Corp (Demo)" } });

  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.create({
    data: { email: "demo-admin@acme.example", passwordHash, fullName: "Demo Admin" }
  });
  await prisma.membership.create({
    data: { userId: admin.id, organizationId: organization.id, role: "ADMIN" }
  });

  // A second account so RBAC/org-visibility can actually be
  // demonstrated (an employee vs. an administrator), not just a
  // single all-powerful login.
  const employee = await prisma.user.create({
    data: { email: "demo-employee@acme.example", passwordHash, fullName: "Demo Employee" }
  });
  await prisma.membership.create({
    data: { userId: employee.id, organizationId: organization.id, role: "DEVELOPER" }
  });

  // One policy per decision action — matches README's demo script,
  // which submits a matching synthetic value for each of these.
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
      },
      {
        organizationId: organization.id,
        name: "Require approval for AWS keys",
        priority: 8,
        action: "REQUIRE_APPROVAL",
        conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "AWS_ACCESS_KEY" }]
      }
    ]
  });

  console.log("Seeded demo data (development use only):");
  console.log(`  Organization: ${organization.name} (${organization.id})`);
  console.log("  Admin login:    demo-admin@acme.example / password123");
  console.log("  Employee login: demo-employee@acme.example / password123");
  console.log("  Policies: Block credit cards, Redact emails, Require approval for AWS keys");
}

main().finally(() => prisma.$disconnect());