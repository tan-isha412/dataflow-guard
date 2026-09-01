import { describe, it, expect, vi } from "vitest";
import { requirePermission } from "../../src/middleware/rbac.js";

describe("requirePermission", () => {
  it("calls next() with no arguments when the role has the permission", () => {
    const middleware = requirePermission("policies:write");
    const req = { auth: { role: "ADMIN" } };
    const next = vi.fn();

    middleware(req, {}, next);

    expect(next).toHaveBeenCalledWith(); // called with NO error
  });

  it("calls next(err) with a 403 when the role lacks the permission", () => {
    const middleware = requirePermission("policies:write");
    const req = { auth: { role: "VIEWER" } };
    const next = vi.fn();

    middleware(req, {}, next);

    const errorArg = next.mock.calls[0][0];
    expect(errorArg.statusCode).toBe(403);
  });
});