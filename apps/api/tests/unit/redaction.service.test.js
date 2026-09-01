import { describe, it, expect } from "vitest";
import { redactContent } from "../../src/modules/redaction/redaction.service.js";

describe("redactContent", () => {
  it("partially masks a credit card, keeping the last 4 digits", () => {
    const text = "Card: 4532015112830366";
    const detections = [{ type: "CREDIT_CARD", start: 6, end: 22 }];
    expect(redactContent(text, detections)).toBe("Card: ************0366");
  });

  it("handles multiple detections without corrupting offsets", () => {
    // This is the test that PROVES the right-to-left sort matters —
    // if it were broken, one of these would be redacted incorrectly.
    const text = "a@b.com and AKIAIOSFODNN7EXAMPLE";
    const detections = [
      { type: "EMAIL", start: 0, end: 7 },
      { type: "AWS_ACCESS_KEY", start: 12, end: 32 }
    ];
    const result = redactContent(text, detections);
    expect(result).not.toContain("a@b.com");
    expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(result).toContain(" and ");
  });
});