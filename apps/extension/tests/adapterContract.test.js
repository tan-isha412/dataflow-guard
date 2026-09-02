import { describe, it, expect } from "vitest";
import { defineAdapter } from "../src/content/adapters/baseAdapter.js";

describe("defineAdapter (contract validation)", () => {
  const validConfig = {
    id: "example",
    matches: () => true,
    getDestination: () => ({}),
    isChatPage: () => true,
    locatePromptInput: () => null,
    getCurrentPromptText: () => "",
    onSubmitAttempt: () => () => {},
    setPromptText: () => false,
    submitApproved: () => false
  };

  it("accepts a config implementing the full contract", () => {
    const adapter = defineAdapter(validConfig);
    expect(adapter.id).toBe("example");
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it("throws when id is missing", () => {
    const { id, ...rest } = validConfig;
    expect(() => defineAdapter(rest)).toThrow(/string id/);
  });

  it("throws when a required method is missing", () => {
    const { matches, ...rest } = validConfig;
    expect(() => defineAdapter(rest)).toThrow(/matches/);
  });

  it("throws when a required method is not a function", () => {
    expect(() => defineAdapter({ ...validConfig, getDestination: "not a function" })).toThrow(/getDestination/);
  });
});
