import { Queue } from "bullmq";
import { connection } from "./connection.js";

// One Queue instance per job TYPE. Naming them clearly ("approval-
// expiry") is what lets the worker app know which processor should
// pick up which jobs — they're matched by this exact string.
export const approvalExpiryQueue = new Queue("approval-expiry", { connection });
export const auditAggregationQueue = new Queue("audit-aggregation", { connection });

// Called from approvals.service.js right after an approval is
// created — schedules a job to run in 24 hours, but returns
// IMMEDIATELY. The API never waits around for the delay to elapse.
export async function scheduleApprovalExpiry(approvalId, delayMs) {
  await approvalExpiryQueue.add("expire", { approvalId }, { delay: delayMs });
}