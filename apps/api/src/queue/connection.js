import { env } from "../config/env.js";

// BullMQ wants its own connection config object (not a live client
// instance like redis.js exports) — this is the shared shape both
// the Queue (producer, in the API) and the Worker (consumer, in the
// worker app) use to connect to the same Redis instance.
export const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  // See config/redis.js's identical option for the full explanation —
  // matches infra/aws/elasticache.tf's transit_encryption_enabled.
  tls: env.REDIS_TLS ? {} : undefined
};