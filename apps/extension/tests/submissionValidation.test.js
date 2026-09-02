import { describe, it, expect } from "vitest";
import { validatePromptSubmission } from "../src/background/inspection/submissionValidation.js";

describe("validatePromptSubmission", () => {
  it("accepts a well-formed submission", () => {
    const result = validatePromptSubmission({
      submissionId: "abc-123",
      content: "explain recursion",
      destination: { destinationId: "chatgpt" }
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a submission with no destination", () => {
    expect(validatePromptSubmission({ submissionId: "abc", content: "hi" }).valid).toBe(true);
  });

  it("rejects a missing payload", () => {
    expect(validatePromptSubmission(undefined).valid).toBe(false);
    expect(validatePromptSubmission(null).valid).toBe(false);
  });

  it("rejects an empty content string", () => {
    expect(validatePromptSubmission({ submissionId: "abc", content: "" }).valid).toBe(false);
  });

  it("rejects a whitespace-only content string", () => {
    expect(validatePromptSubmission({ submissionId: "abc", content: "   " }).valid).toBe(false);
  });

  it("rejects a non-string content", () => {
    expect(validatePromptSubmission({ submissionId: "abc", content: 12345 }).valid).toBe(false);
  });

  it("rejects a missing submissionId", () => {
    expect(validatePromptSubmission({ content: "hi" }).valid).toBe(false);
  });

  it("rejects a malformed destination (no destinationId)", () => {
    expect(validatePromptSubmission({ submissionId: "abc", content: "hi", destination: {} }).valid).toBe(false);
  });

  it("accepts a very long prompt", () => {
    const longContent = "a".repeat(50000);
    expect(validatePromptSubmission({ submissionId: "abc", content: longContent }).valid).toBe(true);
  });

  it("accepts unicode content", () => {
    expect(validatePromptSubmission({ submissionId: "abc", content: "こんにちは 🎉 émigré" }).valid).toBe(true);
  });
});
