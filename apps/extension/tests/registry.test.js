import { describe, it, expect, vi } from "vitest";
import { resolveAdapter } from "../src/content/adapters/registry.js";

describe("resolveAdapter", () => {
  it("resolves the ChatGPT adapter for a chatgpt.com URL", () => {
    const adapter = resolveAdapter(new URL("https://chatgpt.com/"));
    expect(adapter?.id).toBe("chatgpt");
  });

  it("returns null for an unsupported website", () => {
    const adapter = resolveAdapter(new URL("https://www.example.com/"));
    expect(adapter).toBeNull();
  });

  it("returns null for a page that merely resembles a supported one", () => {
    const adapter = resolveAdapter(new URL("https://not-chatgpt.com/"));
    expect(adapter).toBeNull();
  });
});

describe("resolveAdapter fault isolation", () => {
  it("does not crash and skips an adapter whose matches() throws", async () => {
    // Import a fresh module graph so this test's mock doesn't leak into
    // the other test files in this suite.
    vi.resetModules();
    vi.doMock("../src/content/adapters/chatgptAdapter.js", () => ({
      chatgptAdapter: {
        id: "chatgpt",
        matches: () => {
          throw new Error("boom");
        }
      }
    }));

    const { resolveAdapter: resolveWithBrokenAdapter } = await import("../src/content/adapters/registry.js");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => resolveWithBrokenAdapter(new URL("https://chatgpt.com/"))).not.toThrow();
    expect(resolveWithBrokenAdapter(new URL("https://chatgpt.com/"))).toBeNull();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    vi.doUnmock("../src/content/adapters/chatgptAdapter.js");
    vi.resetModules();
  });
});
