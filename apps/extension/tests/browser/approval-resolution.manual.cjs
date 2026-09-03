#!/usr/bin/env node
/**
 * Real-browser verification of the Phase 5 follow-up added after the
 * original Phase 4/5 manual test was written: once REQUIRE_APPROVAL is
 * shown, the extension polls the existing GET /approvals/:id endpoint
 * (bounded, every 5s) and reflects APPROVED/REJECTED once a human
 * decides it — see promptInterceptor.js's startApprovalPoll().
 *
 * Same harness/pattern as prompt-interception.manual.cjs (real unpacked
 * extension, real Chromium, real backend, a synthetic page served as
 * https://chatgpt.com/*) — kept as a separate file so this one narrow
 * scenario doesn't risk the already-passing broader test.
 *
 * Usage: node apps/extension/tests/browser/approval-resolution.manual.cjs
 * Env: same as prompt-interception.manual.cjs (API_BASE_URL,
 * EXTENSION_DIST_PATH, CHROMIUM_EXECUTABLE_PATH, HEADLESS)
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright");

const EXT_PATH = process.env.EXTENSION_DIST_PATH || path.resolve(__dirname, "../../dist");
const SYNTHETIC_HTML = fs.readFileSync(path.join(__dirname, "synthetic-chatgpt.html"), "utf-8");
const API_BASE = process.env.API_BASE_URL || "http://localhost:5000/api/v1";
const TEST_EMAIL = `approval-resolution-${Date.now()}@example.com`;
const TEST_PASSWORD = "password123";
const USER_DATA_DIR = path.join(os.tmpdir(), `dfg-approval-resolution-${Date.now()}`);

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("  FAIL - " + msg);
    return;
  }
  console.log("  ok - " + msg);
}

async function apiCall(apiPath, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}${apiPath}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

(async () => {
  console.log("=== Backend setup ===");
  const register = await apiCall("/auth/register", {
    method: "POST",
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, fullName: "Approval Resolution Tester", organizationName: "Approval Resolution Org" }
  });
  assert(register.status === 201, `registered test org (status ${register.status})`);
  const { accessToken } = register.body;

  const policyRes = await apiCall("/policy", {
    method: "POST",
    token: accessToken,
    body: { name: "Require approval for AWS keys", priority: 8, action: "REQUIRE_APPROVAL", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "AWS_ACCESS_KEY" }] }
  });
  assert(policyRes.status === 201, `created REQUIRE_APPROVAL policy (status ${policyRes.status})`);

  console.log("\n=== Launch extension ===");
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: process.env.HEADLESS !== "false",
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, "--no-sandbox"]
  });

  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 15000 });
  const extensionId = sw.url().split("/")[2];

  await context.route("https://chatgpt.com/**", (route) => route.fulfill({ contentType: "text/html", body: SYNTHETIC_HTML }));

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await popup.waitForSelector("#loginView:not([hidden])");
  await popup.fill("#email", TEST_EMAIL);
  await popup.fill("#password", TEST_PASSWORD);
  await popup.click("#loginButton");
  await popup.waitForSelector("#sessionView:not([hidden])", { timeout: 5000 });
  await popup.close();

  const page = await context.newPage();
  await page.goto("https://chatgpt.com/");
  await page.waitForSelector("#prompt-textarea");
  await page.waitForTimeout(300);

  async function panelState() {
    const host = await page.evaluateHandle(() => document.getElementById("dataflow-guardian-panel-host"));
    if (!(await host.evaluate((h) => h !== null))) return null;
    return page.evaluate(() => {
      const host = document.getElementById("dataflow-guardian-panel-host");
      const shadow = host.shadowRoot;
      return { title: shadow.querySelector(".title span").textContent, body: shadow.querySelector(".body").textContent };
    });
  }

  console.log("\n=== TEST: REQUIRE_APPROVAL, then an admin approves it out of band ===");
  await page.locator("#prompt-textarea").click();
  await page.keyboard.type("My AWS key is AKIAIOSFODNN7EXAMPLE, need this reviewed.");
  await page.locator('[data-testid="send-button"]').click();

  await page.waitForFunction(() => {
    const host = document.getElementById("dataflow-guardian-panel-host");
    return host && host.shadowRoot.querySelector(".title span").textContent === "Approval required";
  }, { timeout: 10000 });
  const pendingPanel = await panelState();
  assert(pendingPanel.title === "Approval required", `panel shows Approval required (got "${pendingPanel.title}")`);
  const refMatch = pendingPanel.body.match(/Reference: ([\w-]+)/);
  assert(Boolean(refMatch), "panel body includes a parseable approval reference id");
  const approvalId = refMatch[1];

  const listRes = await apiCall("/approvals?status=PENDING", { token: accessToken });
  assert(listRes.body.some((a) => a.id === approvalId), "the referenced approval really exists as PENDING in the backend");

  console.log("(simulating an admin decision via PATCH /approvals/:id/decide, out of band from the extension)");
  const decideRes = await apiCall(`/approvals/${approvalId}/decide`, { method: "PATCH", token: accessToken, body: { decision: "APPROVED" } });
  assert(decideRes.status === 200 && decideRes.body.status === "APPROVED", "backend approval decided as APPROVED");

  console.log("waiting for the extension's poll to notice (bounded, ~5s interval)...");
  await page.waitForFunction(() => {
    const host = document.getElementById("dataflow-guardian-panel-host");
    return host && host.shadowRoot.querySelector(".title span").textContent === "Approved";
  }, { timeout: 15000 });
  const approvedPanel = await panelState();
  assert(approvedPanel.title === "Approved", `panel updates to Approved once the backend reflects it (got "${approvedPanel.title}")`);

  const submittedAfterApproval = await page.evaluate(() => window.__submittedMessages);
  assert(
    !submittedAfterApproval.some((m) => m.includes("AKIAIOSFODNN7EXAMPLE")),
    "the extension does NOT auto-resubmit on approval — the original content still never reached the page on its own"
  );

  await context.close();
  fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });

  if (failures > 0) {
    console.error(`\n${failures} ASSERTION(S) FAILED`);
    process.exit(1);
  }
  console.log("\nALL ASSERTIONS PASSED");
})().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
