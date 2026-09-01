import { Worker } from "bullmq";
import { connection } from "../config/connection.js";

// Handles anything that shouldn't block the request that triggered
// it — e.g. emailing an approver when a new REQUIRE_APPROVAL request
// is created. Failure here should never affect whether the approval
// itself was created successfully; notification is best-effort.
export const notificationsWorker = new Worker(
  "notifications",
  async (job) => {
    const { type, recipientEmail, payload } = job.data;

    try {
      await sendEmail(type, recipientEmail, payload); // stubbed — swap in a real provider (SES, Postmark, etc.)
    } catch (err) {
      console.error(`Notification failed for ${recipientEmail}:`, err.message);
      // deliberately does NOT rethrow — a failed email should not
      // retry forever or alarm anyone; it's logged and dropped
    }
  },
  { connection }
);