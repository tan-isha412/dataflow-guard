import { describe, it, expect } from "vitest";
import { detectPhoneNumbers } from "../../../src/modules/inspection/detectors/phone.detector.js";

describe("detectPhoneNumbers", () => {
  it("detects a standard US format", () => {
    expect(detectPhoneNumbers("Call 555-123-4567 now")).toHaveLength(1);
  });

  it("detects a number with a country code", () => {
    expect(detectPhoneNumbers("+91 9876543210")).toHaveLength(1);
  });

  it("does not match a short random number sequence", () => {
    expect(detectPhoneNumbers("order #123")).toHaveLength(0);
  });
});