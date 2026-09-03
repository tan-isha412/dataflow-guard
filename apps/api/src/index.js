import { app } from "./app.js";
import { env } from "./config/env.js";
import { scheduleAuditRetentionSweep } from "./queue/queues.js";

app.listen(env.API_PORT, () => {
  console.log(`DataFlow Guardian API listening on port ${env.API_PORT}`);
});

// Best-effort: if Redis isn't reachable yet, the sweep just doesn't get
// (re-)registered this boot — it never blocks the API from serving
// requests.
scheduleAuditRetentionSweep().catch((err) => {
  console.error("Could not schedule audit retention sweep:", err.message);
});