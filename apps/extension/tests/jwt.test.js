import { describe, it, expect } from "vitest";
import { decodeJwtPayload, isTokenExpired } from "../src/background/auth/jwt.js";

function makeToken(payload) {
  const base64url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${base64url({ alg: "none" })}.${base64url(payload)}.signature-not-verified-client-side`;
}

describe("decodeJwtPayload", () => {
  it("reads claims out of a token without verifying its signature", () => {
    const token = makeToken({ userId: "u1", organizationId: "o1", role: "ADMIN" });
    expect(decodeJwtPayload(token)).toEqual({ userId: "u1", organizationId: "o1", role: "ADMIN" });
  });

  it("throws on a malformed token", () => {
    expect(() => decodeJwtPayload("not-a-jwt")).toThrow();
  });
});

describe("isTokenExpired", () => {
  it("is false for a token whose exp is in the future", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("is true for a token whose exp is in the past", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("is true for a malformed token (fails safe, treats as expired)", () => {
    expect(isTokenExpired("garbage")).toBe(true);
  });
});
