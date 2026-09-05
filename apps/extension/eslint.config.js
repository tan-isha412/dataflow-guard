import js from "@eslint/js";
import globals from "globals";

// See apps/api/eslint.config.js for why this file needed to exist at
// all. `globals.webextensions` adds `chrome`, `browser`, etc. — this
// codebase's content scripts/background service worker/popup all run
// in that environment, on top of the standard browser globals.
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.webextensions }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  }
];
