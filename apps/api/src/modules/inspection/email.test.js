import { describe, it, expect } from "vitest";
import { detectEmails } from "../../../src/modules/inspection/detectors/email.detector.js";

describe("detectEmails", () => {
  it("finds a single email and reports correct offsets", () => {
    const text = "Contact tan@example.com for help.";
    const [detection] = detectEmails(text);

    expect(detection.type).toBe("EMAIL");
    expect(text.slice(detection.start, detection.end)).toBe("tan@example.com");
  });

  it("finds multiple emails in one string", () => {
    const text = "a@b.com and c@d.com";
    expect(detectEmails(text)).toHaveLength(2);
  });

  it("returns an empty array when there's no email", () => {
    expect(detectEmails("no email here")).toHaveLength(0);
  });
});