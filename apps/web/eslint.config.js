import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// See apps/api/eslint.config.js for why this file needed to exist at
// all — same fix, applied per workspace since each one's `lint`
// script runs `eslint src` from its own directory.
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // Vite's React plugin uses the automatic JSX runtime
      "react/prop-types": "off", // plain JS, not TypeScript — no prop-types in this codebase
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    },
    settings: { react: { version: "detect" } }
  }
];
