#!/usr/bin/env node
/**
 * Manual/local end-to-end verification of the Phase 4/5 prompt
 * interception + enforcement pipeline, driven through a REAL Chromium
 * browser with the REAL unpacked extension loaded — not a unit test.
 *
 * Not wired into `npm test` because it needs live infrastructure the
 * unit tests don't: a running DataFlow Guardian API (with Postgres +
 * Redis behind it) and a Playwright-controlled Chromium.
 *
 * WHY A SYNTHETIC PAGE, NOT chatgpt.com ITSELF: this exercises the real
 * production code — real manifest, real content-script.js, real
 * chatgptAdapter.js, real background service worker, real backend
 * decisions — everything except ChatGPT's own DOM structure, which
 * this test environment has no network route to verify against. The
 * page below is built to the same shape chatgptAdapter.js's selectors
 * expect (#prompt-textarea, [data-testid="send-button"]). It's served
 * via Playwright's request interception for the REAL https://chatgpt.com
 * origin, so manifest.json's content_scripts.matches genuinely applies —
 * the browser's address bar and origin really are chatgpt.com.
 *
 * Prerequisites:
 *   1. Postgres + Redis running, DATABASE_URL/REDIS_* configured
 *   2. `npm run build --workspace=@dataflow-guardian/extension`
 *   3. The API running at API_BASE_URL (default http://localhost:5000)
 *   4. Playwright installed with a Chromium build available
 *
 * Usage:
 *   node apps/extension/tests/browser/prompt-interception.manual.cjs
 *
 * Env overrides:
 *   API_BASE_URL             default http://localhost:5000/api/v1
 *   EXTENSION_DIST_PATH      default apps/extension/dist (built above)
 *   CHROMIUM_EXECUTABLE_PATH optional; omit to use Playwright's own browser
 *   HEADLESS                 default "true"
 */
// Deliberately CommonJS (.cjs), even though the rest of this package is
// ESM ("type": "module") — Playwright is typically available via a
// global/shared install (see the repo README's browser-testing note),
// and Node's ESM resolver does not honor NODE_PATH the way `require`
// does, so this stays CJS for that lookup to work in every environment.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright");

const EXT_PATH = process.env.EXTENSION_DIST_PATH || path.resolve(__dirname, "../../dist");
const SYNTHETIC_HTML = fs.readFileSync(path.join(__dirname, "synthetic-chatgpt.html"), "utf-8");
const API_BASE = process.env.API_BASE_URL || "http://localhost:5000/api/v1";
const TEST_EMAIL = `phase45-${Date.now()}@example.com`;
const TEST_PASSWORD = "password123";
const USER_DATA_DIR = path.join(os.tmpdir(), `dfg-prompt-interception-${Date.now()}`);

const timings = {};
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
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, fullName: "Phase45 Tester", organizationName: "Phase45 Org" }
  });
  assert(register.status === 201, `registered test org (status ${register.status})`);
  const { accessToken } = register.body;

  const policies = [
    { name: "Block credit cards", priority: 10, action: "BLOCK", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "CREDIT_CARD" }] },
    { name: "Redact emails", priority: 5, action: "REDACT", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "EMAIL" }] },
    { name: "Require approval for AWS keys", priority: 8, action: "REQUIRE_APPROVAL", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "AWS_ACCESS_KEY" }] }
  ];
  for (const policy of policies) {
    const res = await apiCall("/policy", { method: "POST", token: accessToken, body: policy });
    assert(res.status === 201, `created policy "${policy.name}" (status ${res.status})`);
  }

  console.log("\n=== Launch extension ===");
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: process.env.HEADLESS !== "false",
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, "--no-sandbox"]
  });

  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 15000 });
  const extensionId = sw.url().split("/")[2];
  console.log("Extension ID:", extensionId);

  // See file header: this makes https://chatgpt.com/* resolve to our
  // synthetic page without ever touching the real network, while the
  // page's actual origin — and therefore the manifest match — is real.
  await context.route("https://chatgpt.com/**", (route) => route.fulfill({ contentType: "text/html", body: SYNTHETIC_HTML }));

  console.log("\n=== Login via popup (real Phase 2 flow) ===");
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await popup.waitForSelector("#loginView:not([hidden])");
  await popup.fill("#email", TEST_EMAIL);
  await popup.fill("#password", TEST_PASSWORD);
  await popup.click("#loginButton");
  await popup.waitForSelector("#sessionView:not([hidden])", { timeout: 5000 });
  assert((await popup.textContent("#userEmail")) === TEST_EMAIL, "popup shows logged in as test user");
  await popup.close();

  const page = await context.newPage();
  await page.goto("https://chatgpt.com/");
  await page.waitForSelector("#prompt-textarea");
  await page.waitForTimeout(300); // let the content script's dynamic imports + adapter resolution settle

  async function typeAndSubmit(text, { viaEnter = false } = {}) {
    await page.locator("#prompt-textarea").click();
    await page.keyboard.type(text);
    const t0 = Date.now();
    if (viaEnter) await page.keyboard.press("Enter");
    else await page.locator('[data-testid="send-button"]').click();
    return t0;
  }

  async function waitForPanelSettled(timeout = 10000) {
    await page.waitForFunction(
      () => {
        const host = document.getElementById("dataflow-guardian-panel-host");
        const body = host?.shadowRoot.querySelector(".body");
        return body && body.textContent !== "Checking with DataFlow Guardian…";
      },
      null,
      { timeout }
    );
    return page.evaluate(() => {
      const host = document.getElementById("dataflow-guardian-panel-host");
      return { title: host.shadowRoot.querySelector(".title span").textContent, body: host.shadowRoot.querySelector(".body").textContent };
    });
  }

  console.log("\n=== TEST: safe prompt -> ALLOW ===");
  const safeText = "Explain recursion in JavaScript.";
  const t0Allow = await typeAndSubmit(safeText);
  const allowedPanel = await waitForPanelSettled();
  timings.allow = Date.now() - t0Allow;
  assert(allowedPanel.title === "Allowed", `panel shows Allowed (got "${allowedPanel.title}")`);
  let submitted = await page.evaluate(() => window.__submittedMessages);
  assert(submitted.length === 1 && submitted[0] === safeText, `original safe text WAS submitted: ${JSON.stringify(submitted)}`);

  console.log("\n=== TEST: sensitive credit card -> BLOCK ===");
  const t0Block = await typeAndSubmit("Here is my card number: 4532015112830366");
  const blockedPanel = await waitForPanelSettled();
  timings.block = Date.now() - t0Block;
  assert(blockedPanel.title === "Request blocked", `panel shows Request blocked (got "${blockedPanel.title}")`);
  assert(blockedPanel.body.includes("CREDIT_CARD"), `panel names the detected type: ${blockedPanel.body}`);
  submitted = await page.evaluate(() => window.__submittedMessages);
  assert(submitted.length === 1, `NO new message reached the page after BLOCK: ${JSON.stringify(submitted)}`);
  await page.evaluate(() => { document.getElementById("prompt-textarea").textContent = ""; });

  console.log("\n=== TEST: sensitive email -> REDACT ===");
  const originalEmailText = "My customer's email is john@example.com, please follow up.";
  const t0Redact = await typeAndSubmit(originalEmailText);
  const redactedPanel = await waitForPanelSettled();
  timings.redact = Date.now() - t0Redact;
  assert(redactedPanel.title === "Sensitive data redacted", `panel shows Sensitive data redacted (got "${redactedPanel.title}")`);
  submitted = await page.evaluate(() => window.__submittedMessages);
  assert(submitted.length === 2, `exactly one new message reached the page: ${JSON.stringify(submitted)}`);
  assert(!submitted[1].includes("john@example.com"), `the ORIGINAL email was NOT sent: "${submitted[1]}"`);
  assert(submitted[1] !== originalEmailText, "the sent text differs from the original (it was sanitized)");
  console.log(`  (sanitized text actually sent: "${submitted[1]}")`);

  console.log("\n=== TEST: AWS key -> REQUIRE_APPROVAL ===");
  const t0Approval = await typeAndSubmit("Our test key is AKIAIOSFODNN7EXAMPLE for the staging bucket.");
  const approvalPanel = await waitForPanelSettled();
  timings.approval = Date.now() - t0Approval;
  assert(approvalPanel.title === "Approval required", `panel shows Approval required (got "${approvalPanel.title}")`);
  assert(approvalPanel.body.includes("Reference:"), `panel shows an approval reference id: ${approvalPanel.body}`);
  submitted = await page.evaluate(() => window.__submittedMessages);
  assert(submitted.length === 2, `NO new message reached the page after REQUIRE_APPROVAL: ${JSON.stringify(submitted)}`);
  const approvalsList = await apiCall("/approvals?status=PENDING", { token: accessToken });
  assert(approvalsList.status === 200 && approvalsList.body.length === 1, `backend actually created 1 PENDING approval: ${JSON.stringify(approvalsList.body)}`);
  await page.evaluate(() => { document.getElementById("prompt-textarea").textContent = ""; });

  console.log("\n=== TEST: Enter-key submission is intercepted the same way ===");
  const enterText = "Submitted via the Enter key, should also be inspected.";
  await typeAndSubmit(enterText, { viaEnter: true });
  const enterPanel = await waitForPanelSettled();
  assert(enterPanel.title === "Allowed", `Enter-key submission was inspected and Allowed (got "${enterPanel.title}")`);
  submitted = await page.evaluate(() => window.__submittedMessages);
  assert(submitted.length === 3 && submitted[2] === enterText, "Enter-submitted text reached the page after being allowed");

  console.log("\n=== TEST: rapid double-click does not fire two inspections ===");
  await page.locator("#prompt-textarea").click();
  await page.keyboard.type("Rapid double click test prompt.");
  // Two locator.click() calls each do real actionability waiting, so
  // against a fast local backend the first request can finish before the
  // second click even fires. Dispatching both raw click events
  // synchronously in one evaluate() call guarantees they land back-to-back
  // in the same tick — the actual race the dedup logic guards against.
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="send-button"]');
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitForPanelSettled();
  submitted = await page.evaluate(() => window.__submittedMessages);
  assert(submitted.length === 4, `exactly ONE message reached the page from the synchronous double-click: ${JSON.stringify(submitted)}`);

  console.log("\n=== TEST: empty prompt is not intercepted ===");
  await page.evaluate(() => { document.getElementById("prompt-textarea").textContent = ""; });
  await page.locator('[data-testid="send-button"]').click();
  await page.waitForTimeout(200);
  const panelAfterEmpty = await page.evaluate(() => {
    const host = document.getElementById("dataflow-guardian-panel-host");
    return host ? host.shadowRoot.querySelector(".title span").textContent : "NO_PANEL";
  });
  assert(panelAfterEmpty !== "DataFlow Guardian", "empty submission did not trigger an inspection request");

  console.log("\n=== TEST: unsupported website is unaffected ===");
  await context.route("https://example.com/**", (route) => route.fulfill({ contentType: "text/html", body: SYNTHETIC_HTML }));
  const otherPage = await context.newPage();
  await otherPage.goto("https://example.com/");
  await otherPage.waitForSelector("#prompt-textarea");
  await otherPage.locator("#prompt-textarea").click();
  await otherPage.keyboard.type("this should never be intercepted");
  await otherPage.locator('[data-testid="send-button"]').click();
  await otherPage.waitForTimeout(300);
  const otherSubmitted = await otherPage.evaluate(() => window.__submittedMessages);
  assert(otherSubmitted.length === 1, "on a non-matched site, the message reached the page immediately (no interception)");
  const otherPanel = await otherPage.evaluate(() => document.getElementById("dataflow-guardian-panel-host"));
  assert(otherPanel === null, "no DataFlow Guardian panel ever appeared on the unsupported site");
  await otherPage.close();

  console.log("\n=== TEST: SPA navigation keeps interception working ===");
  await page.evaluate(() => history.pushState({}, "", "/c/fake-conversation-id"));
  await page.waitForTimeout(200);
  await page.locator("#prompt-textarea").click();
  await page.keyboard.type("After navigating within the SPA, this should still be inspected.");
  await page.locator('[data-testid="send-button"]').click();
  const afterNavPanel = await waitForPanelSettled();
  assert(afterNavPanel.title === "Allowed", `interception still works after SPA navigation (got "${afterNavPanel.title}")`);

  console.log("\n=== TEST: logged out mid-session -> AUTH_REQUIRED, fails closed ===");
  const beforeLogoutCount = await page.evaluate(() => window.__submittedMessages.length);
  const logoutPopup = await context.newPage();
  await logoutPopup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await logoutPopup.waitForSelector("#sessionView:not([hidden])");
  await logoutPopup.click("#logoutButton");
  await logoutPopup.waitForSelector("#loginView:not([hidden])");
  await logoutPopup.close();
  await page.locator("#prompt-textarea").click();
  await page.keyboard.type("This should require sign-in, not go through.");
  await page.locator('[data-testid="send-button"]').click();
  const loggedOutPanel = await waitForPanelSettled();
  assert(loggedOutPanel.title === "Sign in required", `panel shows Sign in required after real logout (got "${loggedOutPanel.title}")`);
  const afterLogoutCount = await page.evaluate(() => window.__submittedMessages.length);
  assert(afterLogoutCount === beforeLogoutCount, "nothing was submitted to the page while logged out");

  console.log("\n=== TIMINGS (real, measured, this run) ===");
  console.log(JSON.stringify(timings, null, 2));

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
