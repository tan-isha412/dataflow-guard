import Redis from "ioredis";
import { env } from "./env.js";

// One shared Redis connection, same principle as db.js's single
// Prisma client — every file that needs Redis imports this instance.
//
// REDIS_TLS matches infra/aws/elasticache.tf's transit_encryption_enabled
// (which requires TLS from any client that connects to it) — local/dev
// Redis has no TLS, so this stays off by default and only production
// (ECS task definitions set REDIS_TLS=true) turns it on.
export const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  tls: env.REDIS_TLS ? {} : undefined,
  maxRetriesPerRequest: null // required by BullMQ's connection requirements
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});