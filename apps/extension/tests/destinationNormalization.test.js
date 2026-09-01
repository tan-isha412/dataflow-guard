import { describe, it, expect } from "vitest";
import { DESTINATION_TYPES as REAL_DESTINATION_TYPES } from "@dataflow-guardian/shared/destination";
import { DESTINATION_TYPES } from "../src/content/adapters/destinationTypes.js";
import { chatgptAdapter } from "../src/content/adapters/chatgptAdapter.js";

describe("destination normalization", () => {
  it("the extension's duplicated EXTERNAL_AI constant matches the real shared package's value", () => {
    // This is what keeps destinationTypes.js (which content scripts must
    // duplicate rather than import — see its file comment) from silently
    // drifting away from packages/shared/src/types/destination.js.
    expect(DESTINATION_TYPES.EXTERNAL_AI).toBe(REAL_DESTINATION_TYPES.EXTERNAL_AI);
  });

  it("ChatGPT's destination metadata uses the shared EXTERNAL_AI vocabulary", () => {
    const destination = chatgptAdapter.getDestination();
    expect(destination).toEqual({
      destinationId: "chatgpt",
      provider: "OpenAI",
      destinationType: REAL_DESTINATION_TYPES.EXTERNAL_AI,
      displayName: "ChatGPT"
    });
  });
});
