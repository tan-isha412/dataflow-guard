describe("Login flow", () => {
  it("registers a new user and lands on the dashboard", () => {
    const email = `test-${Date.now()}@example.com`;

    cy.visit("/register");
    cy.get('input[name="fullName"]').type("Test User");
    cy.get('input[name="email"]').type(email);
    cy.get('input[name="password"]').type("password123");
    cy.get('input[name="organizationName"]').type("Test Org");
    cy.get("form").submit();

    cy.url().should("eq", "http://localhost:5173/");
    cy.contains("Dashboard");
  });

  it("rejects a wrong password", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type("nonexistent@example.com");
    cy.get('input[type="password"]').type("wrongpassword");
    cy.get("form").submit();
    cy.contains("Invalid email or password");
  });
});