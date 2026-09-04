import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { redisClient } from "./config/redis.js";
import { scheduleAuditRetentionSweep } from "./queue/queues.js";

const server = app.listen(env.API_PORT, () => {
  console.log(`DataFlow Guardian API listening on port ${env.API_PORT}`);
});

// Best-effort: if Redis isn't reachable yet, the sweep just doesn't get
// (re-)registered this boot — it never blocks the API from serving
// requests.
scheduleAuditRetentionSweep().catch((err) => {
  console.error("Could not schedule audit retention sweep:", err.message);
});

// Phase 9: ECS (and most orchestrators) send SIGTERM before killing a
// task during a deploy or scale-in, then SIGKILL after a grace period —
// without this, in-flight requests get dropped mid-response instead of
// finishing, and the DB/Redis connections leak rather than closing
// cleanly. server.close() stops accepting NEW connections but lets
// already-open ones finish; the process exits once that (plus closing
// the DB/Redis connections) completes, or after a hard timeout so a
// stuck shutdown can never hang the deployment indefinitely.
const SHUTDOWN_TIMEOUT_MS = 10_000;

function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  server.close(async () => {
    try {
      await Promise.all([prisma.$disconnect(), redisClient.quit()]);
    } catch (err) {
      console.error("Error during shutdown cleanup:", err.message);
    } finally {
      clearTimeout(forceExitTimer);
      process.exit(0);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
