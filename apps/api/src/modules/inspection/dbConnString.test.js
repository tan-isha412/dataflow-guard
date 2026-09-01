import { describe, it, expect } from "vitest";
import { detectDbConnectionStrings } from "../../../src/modules/inspection/detectors/dbConnString.detector.js";

describe("detectDbConnectionStrings", () => {
  it("detects a postgres connection string", () => {
    expect(detectDbConnectionStrings("url=postgres://user:pass@host:5432/db")).toHaveLength(1);
  });

  it("detects a mongodb+srv connection string", () => {
    expect(detectDbConnectionStrings("mongodb+srv://admin:secret@cluster0.mongodb.net")).toHaveLength(1);
  });
});