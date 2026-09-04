// Real performance benchmark — Phase 10. Every number this script prints
// comes from an actual measured operation (real HTTP round-trips against a
// live server, real calls into the real detection/policy/decision code).
// Nothing here is estimated or hardcoded. Run with the API server already
// running (npm run dev, or `node src/index.js`) against a real Postgres +
// Redis, then: `node scripts/benchmark.js`.
//
// Two measurement modes:
//  1. In-process timing of the pure, synchronous stages (detection, policy
//     evaluation) by calling the real modules directly — isolates each
//     stage's own cost with zero HTTP/DB overhead in the measurement.
//  2. Real HTTP round-trips against a live server for the full /inspect
//     request (network + auth + DB + everything) — "API request time" /
//     "total latency" as an actual client would experience it.
import { detectSensitiveData } from "../src/modules/inspection/inspection.service.js";
import { makeDecision } from "../src/modules/decision/decision.service.js";
import { calculateRiskScore } from "../src/modules/risk/risk.service.js";

const BASE_URL = process.env.BENCHMARK_BASE_URL ?? "http://localhost:5000/api/v1";
const ITERATIONS = Number(process.env.BENCHMARK_ITERATIONS ?? 500);
const WARMUP = 20;

// Representative payloads — not all ALLOW. A benchmark that only measures
// the cheapest path (no detections, no policy match) would understate real
// production latency, where a meaningful fraction of traffic hits BLOCK/
// REDACT/REQUIRE_APPROVAL paths that do more work (redaction, more policy
// conditions to evaluate).
const PAYLOADS = [
  { label: "plain (no detections)", content: "What's a good recipe for banana bread?" },
  { label: "credit card (BLOCK)", content: "My card number is 4532015112830366, please remember it." },
  { label: "email (REDACT candidate)", content: "Reach me at jane.doe@example.com if you have questions." },
  { label: "phone (REDACT candidate)", content: "Call me back at 415-555-0199 when you get this." },
  { label: "mixed / long", content: "Hi, I'm jane.doe@example.com, my number is 415-555-0199 and my card is 4532015112830366. " + "Also here's some unrelated context. ".repeat(20) }
];

const REPRESENTATIVE_POLICIES = [
  { id: "p1", organizationId: "bench-org", name: "Block credit cards", priority: 10, enabled: true, action: "BLOCK", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "CREDIT_CARD" }] },
  { id: "p2", organizationId: "bench-org", name: "Redact emails", priority: 5, enabled: true, action: "REDACT", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "EMAIL" }] },
  { id: "p3", organizationId: "bench-org", name: "Redact phone numbers", priority: 5, enabled: true, action: "REDACT", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "PHONE" }] }
];

function percentile(sortedMs, p) {
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, idx)];
}

function summarize(label, samplesMs) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    label,
    n: sorted.length,
    min: sorted[0],
    avg: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1]
  };
}

function printTable(rows) {
  const cols = ["label", "n", "min", "avg", "p50", "p95", "p99", "max"];
  const fmt = (v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v));
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => fmt(r[c]).length)));
  const printRow = (vals) => console.log(vals.map((v, i) => String(v).padEnd(widths[i])).join("  "));
  printRow(cols);
  printRow(widths.map((w) => "-".repeat(w)));
  for (const r of rows) printRow(cols.map((c) => fmt(r[c])));
}

async function benchmarkDetection() {
  const samples = [];
  for (let i = 0; i < WARMUP; i++) detectSensitiveData(PAYLOADS[i % PAYLOADS.length].content);
  for (let i = 0; i < ITERATIONS; i++) {
    const payload = PAYLOADS[i % PAYLOADS.length];
    const start = performance.now();
    detectSensitiveData(payload.content);
    samples.push(performance.now() - start);
  }
  return summarize("detection (in-process)", samples);
}

async function benchmarkPolicyEvaluation() {
  const samples = [];
  const detections = detectSensitiveData(PAYLOADS[4].content); // the mixed payload — exercises real policy matching
  const riskScore = calculateRiskScore(detections, { destinationId: null, destinationType: null, riskLevel: "LOW" });
  for (let i = 0; i < WARMUP; i++) await makeDecision({ content: PAYLOADS[4].content, detections, policies: REPRESENTATIVE_POLICIES, riskScore, destinationContext: null, userRole: null });
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await makeDecision({ content: PAYLOADS[4].content, detections, policies: REPRESENTATIVE_POLICIES, riskScore, destinationContext: null, userRole: null });
    samples.push(performance.now() - start);
  }
  return summarize("policy evaluation (in-process)", samples);
}

async function registerBenchmarkUser() {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `benchmark-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Benchmark User",
      organizationName: "Benchmark Org"
    })
  });
  if (!res.ok) throw new Error(`benchmark registration failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return { accessToken: body.accessToken, organizationId: body.organization.id };
}

async function seedRepresentativePolicies(accessToken) {
  for (const policy of REPRESENTATIVE_POLICIES) {
    await fetch(`${BASE_URL}/policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: policy.name, priority: policy.priority, action: policy.action, conditions: policy.conditions })
    });
  }
}

async function benchmarkHttpInspect(accessToken) {
  const samples = [];
  for (let i = 0; i < WARMUP; i++) {
    const payload = PAYLOADS[i % PAYLOADS.length];
    await fetch(`${BASE_URL}/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ content: payload.content })
    });
  }
  for (let i = 0; i < ITERATIONS; i++) {
    const payload = PAYLOADS[i % PAYLOADS.length];
    const start = performance.now();
    const res = await fetch(`${BASE_URL}/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ content: payload.content })
    });
    await res.json();
    samples.push(performance.now() - start);
  }
  return summarize("POST /inspect — full HTTP round-trip (total latency)", samples);
}

async function main() {
  console.log(`DataFlow Guardian — real performance benchmark`);
  console.log(`Target: ${BASE_URL} | iterations per measurement: ${ITERATIONS} (+ ${WARMUP} warmup, discarded)\n`);

  const healthRes = await fetch(`${BASE_URL.replace("/api/v1", "")}/health/ready`).catch(() => null);
  if (!healthRes || !healthRes.ok) {
    console.error("API is not reachable/ready at", BASE_URL, "— start it first (node src/index.js) and ensure Postgres + Redis are up.");
    process.exit(1);
  }

  console.log("Registering a real benchmark org + seeding representative policies...");
  const { accessToken } = await registerBenchmarkUser();
  await seedRepresentativePolicies(accessToken);

  console.log("\n--- In-process stage timings (no HTTP/DB overhead) ---");
  const detectionResult = await benchmarkDetection();
  const policyResult = await benchmarkPolicyEvaluation();
  printTable([detectionResult, policyResult]);

  console.log("\n--- Real HTTP round-trip against the live server (includes DB writes, audit event) ---");
  const httpResult = await benchmarkHttpInspect(accessToken);
  printTable([httpResult]);

  console.log("\nAll times in milliseconds. p50/p95/p99 computed from the sorted real sample array (no synthetic/estimated values).");
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
