import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";

// Phase 10 authentication security requirements not already covered by
// auth.protected.test.js (missing token, malformed token, invalid
// refresh token) or authBruteForce.test.js (rate limiting).
describe("Authentication security", () => {
  let accessToken;
  let organizationId;
  let userId;

  beforeAll(async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `auth-security-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Auth Security Test",
      organizationName: "Auth Security Org"
    });
    accessToken = res.body.accessToken;
    organizationId = res.body.organization.id;
    userId = res.body.user.id;
  });

  it("rejects an EXPIRED access token — a real, correctly-signed JWT that has simply passed its exp", async () => {
    // Signed with the same secret + claim shape jwt.util.js uses, but
    // with expiresIn already in the past — this is what
    // verifyAccessToken() actually has to reject on its own (jwt.verify
    // throws TokenExpiredError), not a stand-in for it.
    const expiredToken = jwt.sign(
      { userId, organizationId, role: "ADMIN" },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "-10s" }
    );

    const res = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects a token signed with the WRONG secret — a forged/tampered token, not just a garbled string", async () => {
    const forgedToken = jwt.sign({ userId, organizationId, role: "ADMIN" }, "not-the-real-secret", { expiresIn: "15m" });

    const res = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${forgedToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects a structurally-empty Authorization header (\"Bearer\" with nothing after it)", async () => {
    const res = await request(app).get("/api/v1/users/me").set("Authorization", "Bearer ");
    expect(res.status).toBe(401);
  });

  it("never returns a password hash in any user-facing response", async () => {
    const res = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/); // bcrypt hash prefix, in case it's nested somewhere unexpected
  });

  it("never returns a JWT secret or other server config in any response, including error responses", async () => {
    const res = await request(app).get("/api/v1/orgs/me"); // no token -> 401
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(process.env.JWT_ACCESS_SECRET);
    expect(body).not.toContain(process.env.JWT_REFRESH_SECRET);
    expect(body).not.toContain(process.env.DATABASE_URL);
  });

  it("registration rejects a password under the minimum length rather than accepting a weak credential", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `weak-password-${Date.now()}@example.com`,
      password: "short",
      fullName: "Weak Password Test",
      organizationName: "Weak Password Org"
    });
    expect(res.status).toBe(400);
  });

  // "Logout" in this architecture (see apps/extension/src/background/
  // auth/authService.js logout(), apps/web/src/hooks/useAuth.js
  // logout()) is CLIENT-SIDE ONLY — it deletes the locally stored
  // tokens and never calls the API. There is no server-side session or
  // token blacklist, so a token that was valid before "logout" remains
  // valid (until its own expiry) if it was captured beforehand. This
  // test documents that as the actual, current behavior — not a gap
  // this suite silently works around — and it's called out explicitly
  // in docs/threat-model.md under "stolen authentication token."
  it("documents (not asserts as a bug): a token issued before logout is still accepted by the API — there is no server-side revocation", async () => {
    const res = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200); // token still works; "logout" never told the server anything
  });
});
