import js from "@eslint/js";
import globals from "globals";

// A previously broken part of this project: `npm run lint` (eslint src)
// had no eslint.config.js anywhere and no eslint dependency of its
// own — it only appeared to exist because a global ESLint install
// happened to be on PATH, and even that failed outright (ESLint 9+
// requires this flat-config file). Kept minimal on purpose — the
// point is a real, working lint pass that catches genuine correctness
// mistakes (undefined variables, unreachable code, duplicate keys),
// not a large rule set to police style.
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  }
];
