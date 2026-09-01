import "./processors/approvalExpiry.processor.js";
import "./processors/auditAggregation.processor.js";

// Importing a Worker file is enough to start it listening — the
// side effect of `new Worker(...)` inside each processor file is
// what actually begins consuming jobs. This file's only job is to
// make sure every processor gets loaded exactly once at startup.
console.log("DataFlow Guardian worker started, listening for jobs...");