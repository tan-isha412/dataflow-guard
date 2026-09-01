import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Destinations flow", () => {
  let accessToken;

  beforeAll(async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `destinations-${Date.now()}@example.com`,
      password: "password123", fullName: "Test", organizationName: "Test Org"
    });
    accessToken = res.body.accessToken;
  });

  it("creates and then approves a destination", async () => {
    const createRes = await request(app).post("/api/v1/destinations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Slack webhook", type: "WEBHOOK", allowedDataTypes: [] });
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe("UNAPPROVED");

    const updateRes = await request(app).patch(`/api/v1/destinations/${createRes.body.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "APPROVED" });
    expect(updateRes.body.status).toBe("APPROVED");
  });
});