import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Auth flow", () => {
  const email = `auth-flow-${Date.now()}@example.com`;

  it("registers, then logs in with the same credentials", async () => {
    const registerRes = await request(app).post("/api/v1/auth/register").send({
      email, password: "password123", fullName: "Test", organizationName: "Test Org"
    });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(app).post("/api/v1/auth/login").send({ email, password: "password123" });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
  });

  it("rejects a duplicate registration with the same email", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email, password: "password123", fullName: "Test", organizationName: "Another Org"
    });
    expect(res.status).toBe(409);
  });

  it("rejects login with a wrong password", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });
});s