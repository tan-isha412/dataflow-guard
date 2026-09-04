import "dotenv/config";

// The worker is a SEPARATE process from the API, so it needs its
// own copy of the connection config — it doesn't import anything
// from apps/api, since these are independently deployable apps.
export const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  // Matches infra/aws/elasticache.tf's transit_encryption_enabled — see
  // apps/api/src/config/redis.js's identical option for the fuller
  // explanation. Off by default (local/dev Redis has no TLS).
  tls: process.env.REDIS_TLS === "true" ? {} : undefined
};