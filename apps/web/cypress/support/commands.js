// cy.login() — referenced by cypress/e2e/playground.cy.js but never
// defined anywhere in this repo before this fix (a real bug: that spec
// could never have passed). Implemented as the file's own comment
// suggested: a real API call, not a UI click-through and not a mock —
// register a fresh org via the actual backend (same endpoint every
// other real registration in this codebase uses), then seed
// localStorage in the exact shape zustand's persist middleware
// produces (authStore.js has no `partialize`, so its persisted state
// is simply { state: { user, organization, accessToken, refreshToken },
// version: 0 } — function-valued store fields like setAuth/clearAuth
// are dropped by JSON.stringify automatically, no filtering needed).
Cypress.Commands.add("login", () => {
  const email = `cypress-login-${Date.now()}@example.com`;
  // Visit the app's own origin FIRST — localStorage is origin-scoped,
  // and before any cy.visit() the AUT window is still about:blank, so
  // writing to `window.localStorage` there would never carry over to
  // http://localhost:5173 once the calling spec's own cy.visit() loads
  // the real page.
  cy.visit("/");
  cy.request("POST", "/api/v1/auth/register", {
    email,
    password: "password123",
    fullName: "Cypress Test User",
    organizationName: "Cypress Test Org"
  }).then((res) => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        "dataflow-guardian-auth",
        JSON.stringify({
          state: {
            user: res.body.user,
            organization: res.body.organization,
            accessToken: res.body.accessToken,
            refreshToken: res.body.refreshToken
          },
          version: 0
        })
      );
    });
  });
});
