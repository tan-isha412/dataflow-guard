#!/usr/bin/env node
/**
 * Validates manifest.json and stages the unpacked extension into dist/.
 * No bundler is used on purpose: an MV3 extension made of plain ES modules
 * and a classic content script needs no transpilation, and adding a
 * bundler now would be an unnecessary dependency for what this phase needs.
 *
 * Phase 9 (production packaging): src/shared/config.js and manifest.json's
 * host_permissions both hardcode http://localhost:5000 for local dev. This
 * script rewrites BOTH, but only in the copied dist/ output — src/ stays
 * localhost-friendly for `npm test`/local development, and dist/ (the
 * thing actually loaded into a browser or zipped for distribution) gets
 * whatever origin the build was actually run for.
 *
 * Usage:
 *   npm run build                                   # dev build, localhost API
 *   API_BASE_URL=https://api.example.com/api/v1 \
 *     npm run build -- --production                 # production build
 *
 * --production refuses to build against a plain http:// origin (other
 * than localhost, which isn't meaningfully "production" anyway) — an
 * extension that ships instructing Chrome to send auth tokens and
 * inspection content over plain HTTP is a real vulnerability, not a
 * configuration nicety.
 */
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, "dist");

const isProduction = process.argv.includes("--production");
const DEV_API_BASE_URL = "http://localhost:5000/api/v1";
const apiBaseUrl = process.env.API_BASE_URL || DEV_API_BASE_URL;

if (isProduction) {
  const origin = new URL(apiBaseUrl);
  if (origin.protocol !== "https:") {
    throw new Error(
      `Refusing a --production build against a non-HTTPS API_BASE_URL ("${apiBaseUrl}"). ` +
        `Auth tokens and inspection content must never travel over plain HTTP in production.`
    );
  }
  if (apiBaseUrl === DEV_API_BASE_URL) {
    throw new Error("API_BASE_URL must be set for a --production build (it still points at the localhost default).");
  }
}

const manifestPath = path.join(rootDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

if (manifest.manifest_version !== 3) {
  throw new Error("manifest.json must declare manifest_version 3");
}
if (!manifest.background?.service_worker) {
  throw new Error("manifest.json is missing background.service_worker");
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// manifest.json: swap the dev-only host_permissions entry for the real
// API origin so the built extension only ever requests access to the
// backend it's actually configured to talk to — never a broader grant
// (e.g. <all_urls>) than the architecture needs.
const apiOrigin = new URL(apiBaseUrl).origin;
const patchedManifest = {
  ...manifest,
  host_permissions: manifest.host_permissions.map((p) => (p === `${DEV_API_BASE_URL.replace(/\/api\/v1$/, "")}/*` ? `${apiOrigin}/*` : p))
};
writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(patchedManifest, null, 2));

cpSync(path.join(rootDir, "src"), path.join(distDir, "src"), { recursive: true });

// config.js: the one file with a literal API_BASE_URL constant. Same
// swap as above, applied to the copied file only.
const configPath = path.join(distDir, "src/shared/config.js");
const configSrc = readFileSync(configPath, "utf-8");
const patchedConfig = configSrc.replace(
  /export const API_BASE_URL = ".*";/,
  `export const API_BASE_URL = ${JSON.stringify(apiBaseUrl)};`
);
if (patchedConfig === configSrc && apiBaseUrl !== DEV_API_BASE_URL) {
  throw new Error("Could not find API_BASE_URL constant in src/shared/config.js to rewrite — build.js and config.js have drifted.");
}
writeFileSync(configPath, patchedConfig);

console.log(
  `DataFlow Guardian extension v${manifest.version} built to ${distDir} ` +
    `(${isProduction ? "production" : "dev"}, API_BASE_URL=${apiBaseUrl}, host_permissions=${patchedManifest.host_permissions.join(", ")})`
);
