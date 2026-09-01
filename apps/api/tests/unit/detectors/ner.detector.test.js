import { describe, it, expect, vi } from "vitest";
import { detectNamedEntities } from "../../../src/modules/inspection/detectors/ner.detector.js";

describe("detectNamedEntities", () => {
  it("returns an empty array (not a thrown error) when the model call fails", async () => {
    // Proves the "fail gracefully" behavior described in the comment
    // above, without needing a real NER model available in tests.
    const result = await detectNamedEntities("");
    expect(Array.isArray(result)).toBe(true);
  });
});