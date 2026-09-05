import { describe, it, expect } from "vitest";
import { detectJwts } from "../../../src/modules/inspection/detectors/jwt.detector.js";

describe("detectJwts", () => {
  it("detects a well-formed JWT", () => {
    const fakeJwt = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.abc123signature";
    expect(detectJwts(fakeJwt)).toHaveLength(1);
  });

  it("does not match plain dotted text", () => {
    expect(detectJwts("file.name.txt")).toHaveLength(0);
  });
});