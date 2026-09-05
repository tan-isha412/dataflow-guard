import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { redisClient } from "./config/redis.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { errorHandler, asyncHandler } from "./middleware/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import orgsRoutes from "./modules/orgs/orgs.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import inspectionRoutes from "./modules/inspection/inspection.routes.js";
import policyRoutes from "./modules/policy/policy.routes.js";
export const app = express();
import inspectRoutes from "./modules/inspect/inspect.routes.js";
import destinationsRoutes from "./modules/destinations/destinations.routes.js";
import approvalsRoutes from "./modules/approvals/approvals.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";

// These four MUST run before any route is mounted — a router mounted
// before express.json() sees req.body as undefined for every POST/PATCH,
// which is silent (falls through to "Required" validation errors, not an
// obvious crash) and previously left approvals/audit/destinations/inspect
// with broken write endpoints.
app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGINS.split(",") }));
app.use(express.json());
app.use(requestId);
app.use(requestLogger);

// Phase 10: this middleware (and its own tests, tests/integration/
// rateLimit.test.js) existed since Day 16 but was never actually
// mounted anywhere — every route was unlimited. Two limiters:
//
// 1. A strict, IP-keyed limit on login specifically — the one endpoint
//    where "many failed attempts in a short window" is itself the
//    attack (credential stuffing / brute force), so it gets a much
//    lower ceiling than everything else and applies even to an
//    unauthenticated caller (rateLimit() falls back to req.ip when
//    there's no req.auth yet, which is always true pre-login).
// 2. A general limit on every other route, keyed by organizationId
//    once authenticated (falling back to IP before that, e.g.
//    /auth/register) — abuse-resistance for the API as a whole, not
//    specific to any one endpoint. Both limiters are mounted here,
//    before any router — see rateLimit.js's own resolveOrganizationId
//    comment for why that means this middleware has to resolve the
//    org itself rather than reading req.auth (which router-level
//    requireAuth hasn't set yet at this point in the stack).
//
// Both fail OPEN if Redis itself is down (see rateLimit.js's own
// comment) — deliberately: a rate limiter is not the security-critical
// control in this system (the inspection pipeline's fail-closed
// behavior is, and that never depends on Redis being reachable for its
// own database-backed checks), so losing it temporarily during a Redis
// outage is an acceptable degradation, not a silent bypass of the
// actual security boundary.
app.use(`${env.API_PREFIX}/auth/login`, rateLimit({ windowSeconds: 60, max: env.RATE_LIMIT_LOGIN_MAX, scope: "auth-login" }));
app.use(`${env.API_PREFIX}`, rateLimit({ windowSeconds: 60, max: env.RATE_LIMIT_GENERAL_MAX, scope: "general" }));

app.use(`${env.API_PREFIX}/approvals`, approvalsRoutes);
app.use(`${env.API_PREFIX}/audit`, auditRoutes);
app.use(`${env.API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${env.API_PREFIX}/destinations`, destinationsRoutes);
app.use(`${env.API_PREFIX}/inspect`, inspectRoutes);
app.use(`${env.API_PREFIX}/orgs`, orgsRoutes);
app.use(`${env.API_PREFIX}/users`, usersRoutes);
app.use(`${env.API_PREFIX}/inspection`, inspectionRoutes);
app.use(`${env.API_PREFIX}/policy`, policyRoutes);

// Liveness: "is the process up and serving HTTP at all" — no
// dependency checks on purpose, so a slow/degraded database never
// makes an orchestrator (ECS, a load balancer) think the process
// itself needs restarting.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Readiness: "can this instance actually serve real traffic right now."
// Reports per-dependency up/down only — never a hostname, port,
// connection string, or driver error message, which is exactly the
// kind of internal infrastructure detail Phase 9's security review
// calls out as something a health endpoint must not leak.
app.get("/health/ready", asyncHandler(async (req, res) => {
  const [dbUp, redisUp] = await Promise.all([checkDatabase(), checkRedis()]);
  const ready = dbUp && redisUp;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    dependencies: { database: dbUp ? "up" : "down", redis: redisUp ? "up" : "down" }
  });
}));

// A short, explicit timeout on both checks — NOT because the DB/redis
// clients are slow to fail on a plain connection refusal, but because
// the shared ioredis client is configured with maxRetriesPerRequest:
// null (see config/redis.js — required so BullMQ jobs keep retrying
// through a transient Redis outage instead of dying). That same setting
// means redisClient.ping() can hang indefinitely instead of rejecting
// while Redis is down, which would otherwise turn a health CHECK into
// a health check that itself never responds — the opposite of useful
// during exactly the outage it exists to report.
const HEALTH_CHECK_TIMEOUT_MS = 2000;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

async function checkDatabase() {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, HEALTH_CHECK_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

async function checkRedis() {
  try {
    return (await withTimeout(redisClient.ping(), HEALTH_CHECK_TIMEOUT_MS)) === "PONG";
  } catch {
    return false;
  }
}

app.use(`${env.API_PREFIX}/auth`, authRoutes);

// Must be the LAST app.use() call — see errorHandler.js for why.
app.use(errorHandler);