// Controlled LOCAL load test — Phase 10. Targets localhost only (never
// public infrastructure, per the explicit instruction not to load-test
// anything but our own local server). Spins up CONCURRENCY separate
// organizations (so the per-org rate limiter — already covered by its
// own dedicated tests — isn't the thing being measured) and fires real
// concurrent POST /inspect requests against a live server for a fixed
// duration, then reports real measured throughput, latency percentiles,
// and error rate.
//
// Run with the API server already running: `node scripts/loadtest.js`
// Env overrides: LOADTEST_CONCURRENCY, LOADTEST_DURATION_SECONDS
const BASE_URL = process.env.BENCHMARK_BASE_URL ?? "http://localhost:5000/api/v1";
const HEALTH_URL = BASE_URL.replace("/api/v1", "") + "/health/ready";
const CONCURRENCY = Number(process.env.LOADTEST_CONCURRENCY ?? 20);
const DURATION_SECONDS = Number(process.env.LOADTEST_DURATION_SECONDS ?? 15);

if (!/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE_URL)) {
  console.error("Refusing to load-test a non-local target:", BASE_URL, "— this script only targets localhost.");
  process.exit(1);
}

const PAYLOADS = [
  "What's a good recipe for banana bread?",
  "My card number is 4532015112830366, please remember it.",
  "Reach me at jane.doe@example.com if you have questions.",
  "Call me back at 415-555-0199 when you get this."
];

function percentile(sortedMs, p) {
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, idx)];
}

async function registerWorkerOrg(i) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `loadtest-${Date.now()}-${i}@example.com`,
      password: "password123",
      fullName: `Load Test Worker ${i}`,
      organizationName: `Load Test Org ${i}`
    })
  });
  if (!res.ok) throw new Error(`worker ${i} registration failed: ${res.status}`);
  const body = await res.json();
  return body.accessToken;
}

async function runWorker(accessToken, deadline, results) {
  let i = 0;
  while (Date.now() < deadline) {
    const content = PAYLOADS[i++ % PAYLOADS.length];
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ content })
      });
      const latencyMs = performance.now() - start;
      results.push({ latencyMs, ok: res.ok, status: res.status });
      if (res.ok) await res.json().catch(() => {});
    } catch (err) {
      results.push({ latencyMs: performance.now() - start, ok: false, status: 0, error: err.message });
    }
  }
}

async function main() {
  console.log(`DataFlow Guardian — controlled LOCAL load test`);
  console.log(`Target: ${BASE_URL} (localhost only) | concurrency: ${CONCURRENCY} workers | duration: ${DURATION_SECONDS}s\n`);

  const healthRes = await fetch(HEALTH_URL).catch(() => null);
  if (!healthRes || !healthRes.ok) {
    console.error("API is not reachable/ready — start it first (node src/index.js).");
    process.exit(1);
  }

  console.log(`Registering ${CONCURRENCY} separate organizations (one per worker, so the per-org rate limiter — already covered by its own dedicated tests — isn't what's being measured here)...`);
  const tokens = [];
  for (let i = 0; i < CONCURRENCY; i++) tokens.push(await registerWorkerOrg(i));

  console.log(`Running ${CONCURRENCY} concurrent workers for ${DURATION_SECONDS}s...\n`);
  const results = [];
  const wallClockStart = performance.now();
  const deadline = Date.now() + DURATION_SECONDS * 1000;
  await Promise.all(tokens.map((token) => runWorker(token, deadline, results)));
  const wallClockMs = performance.now() - wallClockStart;

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);
  const rateLimited = failures.filter((r) => r.status === 429);
  const realErrors = failures.filter((r) => r.status !== 429);

  const throughputRps = results.length / (wallClockMs / 1000);

  console.log("--- Results (all real, measured against the live local server) ---");
  console.log(`Total requests:      ${results.length}`);
  console.log(`Wall-clock duration: ${(wallClockMs / 1000).toFixed(2)}s`);
  console.log(`Throughput:          ${throughputRps.toFixed(1)} req/s`);
  console.log(`Successful (2xx):    ${successes.length} (${((successes.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`Rate-limited (429):  ${rateLimited.length} (${((rateLimited.length / results.length) * 100).toFixed(1)}%) — expected once a worker's own org exceeds the general limit within the run`);
  console.log(`Real errors (other): ${realErrors.length} (${((realErrors.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`\nLatency (ms):  min ${latencies[0]?.toFixed(2)}  avg ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)}  p50 ${percentile(latencies, 50).toFixed(2)}  p95 ${percentile(latencies, 95).toFixed(2)}  p99 ${percentile(latencies, 99).toFixed(2)}  max ${latencies[latencies.length - 1]?.toFixed(2)}`);

  if (realErrors.length > 0) {
    console.log("\nSample real errors:");
    for (const e of realErrors.slice(0, 5)) console.log(`  status=${e.status} ${e.error ?? ""}`);
  }
}

main().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
