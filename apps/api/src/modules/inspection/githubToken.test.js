import { describe, it, expect } from "vitest";
import { detectGithubTokens } from "../../../src/modules/inspection/detectors/githubToken.detector.js";

describe("detectGithubTokens", () => {
  it("detects a personal access token (ghp_ prefix)", () => {
    const token = "ghp_" + "a".repeat(36);
    expect(detectGithubTokens(token)).toHaveLength(1);
  });

  it("detects an oauth token (gho_ prefix)", () => {
    const token = "gho_" + "b".repeat(36);
    expect(detectGithubTokens(token)).toHaveLength(1);
  });

  it("does not match an unrelated gh-prefixed word", () => {
    expect(detectGithubTokens("github_actions_workflow")).toHaveLength(0);
  });
});