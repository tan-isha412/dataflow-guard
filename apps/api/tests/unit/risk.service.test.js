import { describe, it, expect } from "vitest";
import { calculateRiskScore } from "../../src/modules/risk/risk.service.js";

describe("calculateRiskScore", () => {
  it("returns 0 for no detections", () => {
    expect(calculateRiskScore([])).toBe(0);
  });

  it("weighs CRITICAL detections higher than LOW ones", () => {
    const low = calculateRiskScore([{ sensitivity: "LOW" }]);
    const critical = calculateRiskScore([{ sensitivity: "CRITICAL" }]);
    expect(critical).toBeGreaterThan(low);
  });

  it("caps the total score at 100", () => {
    const manyCriticals = Array.from({ length: 20 }, () => ({ sensitivity: "CRITICAL" }));
    expect(calculateRiskScore(manyCriticals)).toBe(100);
  });
});