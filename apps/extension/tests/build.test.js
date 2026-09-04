import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildScript = path.join(rootDir, "scripts/build.js");
const distDir = path.join(rootDir, "dist");

// Phase 9: scripts/build.js is the only thing standing between "an
// extension that works against localhost" and "an extension that ships
// to real employees" — its URL-rewriting and HTTP-refusal logic is real
// production-safety logic, not just a build convenience, so it gets
// real tests (spawning the actual script, not re-implementing its logic
// here) rather than being verified by hand once and trusted forever.
describe("scripts/build.js", () => {
  afterEach(() => {
    // Leave a normal dev build behind so other manual/local workflows
    // that assume dist/ points at localhost aren't left in a surprising
    // state by this test file.
    execFileSync("node", [buildScript], { cwd: rootDir });
  });

  it("a plain build defaults to the localhost dev API and matching host_permissions", () => {
    execFileSync("node", [buildScript], { cwd: rootDir });
    const manifest = JSON.parse(readFileSync(path.join(distDir, "manifest.json"), "utf-8"));
    const config = readFileSync(path.join(distDir, "src/shared/config.js"), "utf-8");

    expect(manifest.host_permissions).toEqual(["http://localhost:5000/*"]);
    expect(config).toContain('export const API_BASE_URL = "http://localhost:5000/api/v1";');
  });

  it("--production rewrites both config.js and manifest.json to the given HTTPS origin", () => {
    execFileSync("node", [buildScript, "--production"], {
      cwd: rootDir,
      env: { ...process.env, API_BASE_URL: "https://api.example.com/api/v1" }
    });
    const manifest = JSON.parse(readFileSync(path.join(distDir, "manifest.json"), "utf-8"));
    const config = readFileSync(path.join(distDir, "src/shared/config.js"), "utf-8");

    expect(manifest.host_permissions).toEqual(["https://api.example.com/*"]);
    expect(config).toContain('export const API_BASE_URL = "https://api.example.com/api/v1";');
  });

  it("refuses a --production build over plain HTTP", () => {
    expect(() =>
      execFileSync("node", [buildScript, "--production"], {
        cwd: rootDir,
        env: { ...process.env, API_BASE_URL: "http://api.example.com/api/v1" },
        stdio: "pipe"
      })
    ).toThrow(/non-HTTPS/);
  });

  it("refuses a --production build with no API_BASE_URL set (still the localhost default)", () => {
    const env = { ...process.env };
    delete env.API_BASE_URL;
    expect(() => execFileSync("node", [buildScript, "--production"], { cwd: rootDir, env, stdio: "pipe" })).toThrow();
  });

  it("never mutates src/shared/config.js itself — only the copied dist/ file", () => {
    const before = readFileSync(path.join(rootDir, "src/shared/config.js"), "utf-8");
    execFileSync("node", [buildScript, "--production"], {
      cwd: rootDir,
      env: { ...process.env, API_BASE_URL: "https://api.example.com/api/v1" }
    });
    const after = readFileSync(path.join(rootDir, "src/shared/config.js"), "utf-8");
    expect(after).toBe(before);
    expect(after).toContain("http://localhost:5000/api/v1");
  });
});
