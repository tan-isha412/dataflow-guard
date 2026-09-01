describe("Playground", () => {
  beforeEach(() => {
    // Assumes a logged-in session is seeded — in a real setup this
    // would call a cy.login() custom command hitting the API
    // directly, rather than clicking through the UI every test.
    cy.login();
    cy.visit("/playground");
  });

  it("flags a credit card as BLOCK when a matching policy exists", () => {
    cy.get("textarea").type("Card number: 4532015112830366");
    cy.get('button[type="submit"]').click();
    cy.contains("Blocked");
  });

  it("allows plain text with no sensitive data", () => {
    cy.get("textarea").type("just a normal sentence");
    cy.get('button[type="submit"]').click();
    cy.contains("Allowed");
  });
});