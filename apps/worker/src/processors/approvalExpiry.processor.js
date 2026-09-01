import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { connection } from "../config/connection.js";

const prisma = new PrismaClient();

// A Worker LISTENS on a named queue — "approval-expiry" here must
// match the string used when the Queue was created in queues.js on
// the API side. This is the entire connection between the two apps:
// they never call each other directly, they only agree on queue names.
export const approvalExpiryWorker = new Worker(
  "approval-expiry",
  async (job) => {
    const { approvalId } = job.data;

    const approval = await prisma.approval.findUnique({ where: { id: approvalId } });

    // Only expire it if it's STILL pending — if a human already
    // approved/rejected it before the 24 hours elapsed, this job
    // should do nothing. Without this check, a fast human decision
    // could get silently overwritten by a stale expiry job later.
    if (approval?.status === "PENDING") {
      await prisma.approval.update({
        where: { id: approvalId },
        data: { status: "EXPIRED", decidedAt: new Date() }
      });
      console.log(`Approval ${approvalId} expired`);
    }
  },
  { connection }
);

approvalExpiryWorker.on("failed", (job, err) => {
  console.error(`Approval expiry job ${job.id} failed:`, err.message);
});