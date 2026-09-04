import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Phase 9/10: an orchestrator (ECS, a load balancer) restarts a
// container that fails liveness and stops routing traffic to one that
// fails readiness — getting these two confused (or leaking internal
// details in either) is a real production incident waiting to happen,
// not just a nice-to-have endpoint.
describe("GET /health", () => {
  it("reports alive with no dependency checks, regardless of DB/Redis state", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /health/ready", () => {
  it("reports ready with both dependencies up (real DB + Redis, this test's own env)", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", dependencies: { database: "up", redis: "up" } });
  });

  it("never includes a connection string, hostname, port, or driver error in the response", async () => {
    const res = await request(app).get("/health/ready");
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/postgres(ql)?:\/\//i);
    expect(serialized).not.toContain(process.env.DATABASE_URL ?? "__unset__");
    expect(Object.keys(res.body.dependencies).sort()).toEqual(["database", "redis"]);
    expect(["up", "down"]).toContain(res.body.dependencies.database);
    expect(["up", "down"]).toContain(res.body.dependencies.redis);
  });
});
