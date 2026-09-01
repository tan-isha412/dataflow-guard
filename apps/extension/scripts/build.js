#!/usr/bin/env node
/**
 * Validates manifest.json and stages the unpacked extension into dist/.
 * No bundler is used on purpose: an MV3 extension made of plain ES modules
 * and a classic content script needs no transpilation, and adding a
 * bundler now would be an unnecessary dependency for what this phase needs.
 */
import { readFileSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, "dist");

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
cpSync(manifestPath, path.join(distDir, "manifest.json"));
cpSync(path.join(rootDir, "src"), path.join(distDir, "src"), { recursive: true });

console.log(`DataFlow Guardian extension v${manifest.version} built to ${distDir}`);
