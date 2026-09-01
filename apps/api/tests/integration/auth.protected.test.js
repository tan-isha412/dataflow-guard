import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Covers the requireAuth middleware (apps/api/src/middleware/auth.js) and
// the /auth/refresh endpoint added for the browser extension's session
// restoration flow — both were previously untested (requireAuth.js was an
// empty file; refresh didn't exist at all).
describe("requireAuth + token refresh", () => {
  const email = `auth-protected-${Date.now()}@example.com`;
  let accessToken;
  let refreshToken;

  it("registers a user to authenticate as", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email, password: "password123", fullName: "Protected Route Test", organizationName: "Protected Org"
    });
    expect(res.status).toBe(201);
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it("rejects a protected route with no Authorization header", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a protected route with a malformed token", async () => {
    const res = await request(app).get("/api/v1/users/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("allows a protected route with a valid access token, scoped to the right org", async () => {
    const usersRes = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.email).toBe(email);

    const orgsRes = await request(app).get("/api/v1/orgs/me").set("Authorization", `Bearer ${accessToken}`);
    expect(orgsRes.status).toBe(200);
    expect(orgsRes.body.name).toBe("Protected Org");
  });

  it("issues a new access token from a valid refresh token", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    const usersRes = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.email).toBe(email);
  });

  it("rejects refresh with an invalid refresh token", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "garbage" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });
});
