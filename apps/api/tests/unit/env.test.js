import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

// env.js validates process.env at import time and process.exit(1)s on
// failure — that side effect makes it awkward to import twice in one
// process with different env vars, so this spawns a real child process
// per case instead, which is also a more honest test: it proves the
// schema actually reads real environment variables, not a re-typed
// mock of them (this exact bug — REDIS_PASSWORD referenced by
// config/redis.js but silently stripped because it wasn't declared in
// the zod schema — is exactly the kind of thing a mocked test would
// have missed).
function readEnv(extraEnv, field) {
  const env = {
    ...process.env,
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    JWT_ACCESS_SECRET: "s1",
    JWT_REFRESH_SECRET: "s2",
    ...extraEnv
  };
  const out = execFileSync(
    "node",
    ["--input-type=module", "-e", `import { env } from "./src/config/env.js"; console.log(JSON.stringify(env.${field}));`],
    { cwd: apiDir, env }
  );
  return JSON.parse(out.toString().trim());
}

describe("env.js", () => {
  it("passes REDIS_PASSWORD through when set (regression test — this was silently dropped before)", () => {
    expect(readEnv({ REDIS_PASSWORD: "hunter2" }, "REDIS_PASSWORD")).toBe("hunter2");
  });

  it("leaves REDIS_PASSWORD undefined when unset (dev Redis has no auth)", () => {
    const env = { PATH: process.env.PATH, DATABASE_URL: "postgresql://u:p@localhost:5432/db", JWT_ACCESS_SECRET: "s1", JWT_REFRESH_SECRET: "s2" };
    // Explicitly rebuild the env object rather than reusing readEnv's
    // spread-from-process.env, in case the host running this test
    // happens to have REDIS_PASSWORD set for some unrelated reason.
    const out = execFileSync(
      "node",
      ["--input-type=module", "-e", 'import { env } from "./src/config/env.js"; console.log(JSON.stringify(env.REDIS_PASSWORD ?? null));'],
      { cwd: apiDir, env }
    );
    expect(JSON.parse(out.toString().trim())).toBeNull();
  });

  it("REDIS_TLS defaults to false and only becomes true for the literal string \"true\"", () => {
    expect(readEnv({}, "REDIS_TLS")).toBe(false);
    expect(readEnv({ REDIS_TLS: "true" }, "REDIS_TLS")).toBe(true);
    expect(readEnv({ REDIS_TLS: "yes" }, "REDIS_TLS")).toBe(false);
  });

  it("passes ALLOWED_ORIGINS through unchanged", () => {
    expect(readEnv({ ALLOWED_ORIGINS: "https://app.example.com,https://admin.example.com" }, "ALLOWED_ORIGINS")).toBe(
      "https://app.example.com,https://admin.example.com"
    );
  });
});
