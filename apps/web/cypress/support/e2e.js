// Cypress's default support-file entry point — required by
// cypress.config.js (no supportFile: false override), and was missing
// entirely before this fix, which meant Cypress failed at config load
// time before either spec in cypress/e2e/ could even start. See
// commands.js for what's actually defined here.
import "./commands.js";
