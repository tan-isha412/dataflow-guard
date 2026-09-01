import { describe, it, expect } from "vitest";
import { detectGenericSecrets } from "../../../src/modules/inspection/detectors/genericSecret.detector.js";

describe("detectGenericSecrets", () => {
  it("detects a labeled api_key value", () => {
    expect(detectGenericSecrets('api_key = "sk_test_abcdef123456"')).toHaveLength(1);
  });

  it("does not match a label with no value", () => {
    expect(detectGenericSecrets("password:")).toHaveLength(0);
  });
});