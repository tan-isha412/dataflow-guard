import { describe, it, expect } from "vitest";
import { resolveHighestPrecedence } from "../../src/modules/decision/decision.precedence.js";

describe("resolveHighestPrecedence", () => {
  it("BLOCK wins over REDACT", () => {
    expect(resolveHighestPrecedence(["REDACT", "BLOCK"])).toBe("BLOCK");
  });

  it("REQUIRE_APPROVAL wins over REDACT but loses to BLOCK", () => {
    expect(resolveHighestPrecedence(["REDACT", "REQUIRE_APPROVAL"])).toBe("REQUIRE_APPROVAL");
    expect(resolveHighestPrecedence(["REQUIRE_APPROVAL", "BLOCK"])).toBe("BLOCK");
  });

  it("defaults to ALLOW with an empty list", () => {
    expect(resolveHighestPrecedence([])).toBe("ALLOW");
  });
});