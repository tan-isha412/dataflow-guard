import { describe, it, expect } from "vitest";
import { detectCustomPatterns } from "../../../src/modules/inspection/detectors/customPattern.detector.js";

describe("detectCustomPatterns", () => {
  it("detects a match against an org-defined pattern", () => {
    const rules = [{ id: "emp-id-v1", pattern: "EMP-\\d{6}", sensitivity: "MEDIUM" }];
    expect(detectCustomPatterns("Employee EMP-123456 was flagged", rules)).toHaveLength(1);
  });

  it("returns nothing when no custom rules are configured", () => {
    expect(detectCustomPatterns("EMP-123456", [])).toHaveLength(0);
  });
});