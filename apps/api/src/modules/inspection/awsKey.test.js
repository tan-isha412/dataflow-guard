import { describe, it, expect } from "vitest";
import { detectAwsKeys } from "../../../src/modules/inspection/detectors/awsKey.detector.js";

describe("detectAwsKeys", () => {
  it("detects a well-formed AWS access key", () => {
    expect(detectAwsKeys("key=AKIAIOSFODNN7EXAMPLE")).toHaveLength(1);
  });

  it("rejects a string that merely starts with AKIA but is too short", () => {
    expect(detectAwsKeys("AKIA123")).toHaveLength(0);
  });
});