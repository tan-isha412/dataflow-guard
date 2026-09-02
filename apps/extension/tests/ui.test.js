import { describe, it, expect } from "vitest";
import { Window } from "happy-dom";
import { createInterceptionUi } from "../src/content/interception/ui.js";

function setup() {
  const window = new Window({ url: "https://chatgpt.com/" });
  return { document: window.document };
}

function panelText(document) {
  const host = document.getElementById("dataflow-guardian-panel-host");
  if (!host) return null;
  const panel = host.shadowRoot.querySelector(".panel");
  return {
    title: panel.querySelector(".title span").textContent,
    body: panel.querySelector(".body").textContent
  };
}

describe("createInterceptionUi", () => {
  it("showInspecting renders a panel with no close button (not dismissible)", () => {
    const { document } = setup();
    const ui = createInterceptionUi(document);
    ui.showInspecting();

    const host = document.getElementById("dataflow-guardian-panel-host");
    expect(host).not.toBeNull();
    expect(panelText(document).title).toBe("DataFlow Guardian");
    expect(host.shadowRoot.querySelector(".close")).toBeNull();
  });

  it("showBlocked includes the detected data type and reason", () => {
    const { document } = setup();
    const ui = createInterceptionUi(document);
    ui.showBlocked({ detections: [{ type: "CREDIT_CARD" }], riskScore: 90, reason: "BLOCK triggered by: CREDIT_CARD" });

    const { title, body } = panelText(document);
    expect(title).toBe("Request blocked");
    expect(body).toContain("CREDIT_CARD");
    expect(body).toContain("90");
  });

  it("showApprovalRequired includes the approval reference id", () => {
    const { document } = setup();
    const ui = createInterceptionUi(document);
    ui.showApprovalRequired({ reason: "needs review", approvalRequestId: "appr-123" });

    const { body } = panelText(document);
    expect(body).toContain("appr-123");
  });

  it("showRedacted does not leak any original sensitive content (only generic copy)", () => {
    const { document } = setup();
    const ui = createInterceptionUi(document);
    ui.showRedacted();
    const { body } = panelText(document);
    expect(body.toLowerCase()).not.toContain("@");
  });

  it("hide() removes the panel from the DOM", () => {
    const { document } = setup();
    const ui = createInterceptionUi(document);
    ui.showAllowed();
    expect(document.getElementById("dataflow-guardian-panel-host")).not.toBeNull();

    ui.hide();
    expect(document.getElementById("dataflow-guardian-panel-host")).toBeNull();
  });

  it("the close button dismisses the panel", () => {
    const { document } = setup();
    const ui = createInterceptionUi(document);
    ui.showBlocked({ detections: [], reason: "x" });

    const host = document.getElementById("dataflow-guardian-panel-host");
    host.shadowRoot.querySelector(".close").dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));

    expect(document.getElementById("dataflow-guardian-panel-host")).toBeNull();
  });

  it("re-rendering (e.g. inspecting -> blocked) replaces the panel content rather than stacking multiple panels", () => {
    const { document } = setup();
    const ui = createInterceptionUi(document);
    ui.showInspecting();
    ui.showBlocked({ detections: [{ type: "EMAIL" }], reason: "x" });

    const hosts = document.querySelectorAll("#dataflow-guardian-panel-host");
    expect(hosts.length).toBe(1);
    expect(panelText(document).title).toBe("Request blocked");
  });
});
