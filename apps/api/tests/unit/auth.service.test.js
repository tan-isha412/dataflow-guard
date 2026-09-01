import { describe, it, expect, vi } from "vitest";
import * as authRepository from "../../src/modules/auth/auth.repository.js";
import { registerUser } from "../../src/modules/auth/auth.service.js";

// vi.spyOn lets you replace a REAL function's implementation
// temporarily, so this test never touches an actual database — pure
// unit test, unlike Day 10/14's integration tests which use a real one.
describe("registerUser", () => {
  it("throws EMAIL_ALREADY_EXISTS when the email is taken", async () => {
    vi.spyOn(authRepository, "findUserByEmail").mockResolvedValue({ id: "existing-user" });

    await expect(
      registerUser({ email: "taken@example.com", password: "password123", fullName: "Test", organizationName: "Org" })
    ).rejects.toThrow("Email already exists");
  });
});