import { AppError } from "./errorHandler.js";
import { redisClient } from "../config/redis.js";
import { verifyAccessToken } from "../modules/auth/jwt.util.js";

// Real bug found during the Phase 11 finishing pass: this middleware is
// mounted in app.js BEFORE every router (it has to be — a rate limiter
// that ran after the route handler already did its work couldn't ever
// block anything), but req.auth is only ever set by requireAuth, which
// each individual router applies to ITSELF (router.use(requireAuth) —
// see orgs.routes.js etc.), further down the middleware stack. That
// means req.auth was ALWAYS undefined at the point this file read it —
// the "general" scope has been keyed by req.ip for every request,
// authenticated or not, since it was first mounted, never by
// organizationId as the comment in app.js (and docs/security.md)
// claimed. Real impact: every organization behind the same egress IP
// (a shared office network/VPN/NAT — completely normal for a real
// company) shared ONE budget, and any one of them could exhaust it for
// everyone else. Fixed below by having this middleware decode the
// bearer token itself (the exact same verifyAccessToken() requireAuth
// uses, so there's one source of truth for what a valid token looks
// like) purely to resolve a stable per-org key — it does NOT enforce
// anything here; an invalid/expired/missing token just falls back to
// IP-keying, and requireAuth (downstream) still independently rejects
// the request on its own terms. This file remains, deliberately, not a
// security boundary.
function resolveOrganizationId(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return verifyAccessToken(header.slice("Bearer ".length)).organizationId;
  } catch {
    return null;
  }
}

// The shared redisClient is configured with maxRetriesPerRequest: null
// (see config/redis.js) so BullMQ jobs keep retrying through a
// transient Redis outage rather than dying — but that same setting
// means redisClient.incr()/.expire() never REJECT while Redis is
// unreachable, they just queue and wait indefinitely for the
// connection to come back. Without this timeout, the catch block below
// (meant to fail the limiter open) would never run, and every request
// through this middleware would hang forever instead — turning a
// Redis outage into a full API outage, exactly what "fail open"
// was supposed to prevent. (Found by actually stopping Redis and
// hitting a rate-limited route — see docs/testing.md.)
const REDIS_TIMEOUT_MS = 1500;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("rate limiter Redis call timed out")), ms))]);
}

// A factory, same shape as requirePermission — rateLimit({...})
// returns a middleware configured with these specific limits.
//
// `scope` namespaces the Redis key so two DIFFERENT rateLimit()
// instances mounted on overlapping paths (e.g. a strict one on
// /auth/login layered under a general one on the whole API — see
// app.js) each get their own independent counter. Without it they'd
// silently share one counter keyed only by caller identity, and the
// stricter limiter's budget would be consumed by traffic the looser
// one was meant to track separately.
export function rateLimit({ windowSeconds = 60, max = 100, scope = "default" } = {}) {
  return async (req, res, next) => {
    const key = `ratelimit:${scope}:${resolveOrganizationId(req) ?? req.ip}`;

    try {
      const count = await withTimeout(redisClient.incr(key), REDIS_TIMEOUT_MS);
      // Only set the expiry on the FIRST request in a fresh window —
      // otherwise a constantly-active caller would keep pushing the
      // reset time forward and the limit would never actually reset.
      // Deliberately not awaited: a slow/failed expire on an ALREADY-
      // successful incr() is not worth delaying (or fail-opening) the
      // whole request over — worst case a key's TTL doesn't get set
      // this one time and Redis GC's it a bit later than intended.
      if (count === 1) {
        redisClient.expire(key, windowSeconds).catch(() => {});
      }

      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(Math.max(0, max - count)));

      if (count > max) {
        return next(new AppError("Too many requests, please slow down", 429, "RATE_LIMITED"));
      }
      next();
    } catch (err) {
      // If Redis itself is down (or too slow to answer within
      // REDIS_TIMEOUT_MS), fail OPEN (let the request through) rather
      // than blocking the entire API — a rate limiter that takes down
      // the whole product when its dependency hiccups is a worse
      // outcome than temporarily unlimited requests. This is NOT the
      // security-critical control in this system (the inspection
      // pipeline's fail-CLOSED behavior is) — see docs/security.md.
      console.error("Rate limiter error, allowing request through:", err.message);
      next();
    }
  };
}
