import "dotenv/config";
import Redis from "ioredis";

// This test suite's .env points REDIS_HOST/PORT at the SAME Redis
// instance local dev uses (there's no separate test Redis) — so the
// rate limiter's counters (middleware/rateLimit.js), which are
// deliberately durable across requests for up to `windowSeconds`, also
// survive from one `vitest run` to the next. Two full suite runs back
// to back (a completely ordinary thing to do locally or in CI) land
// inside the SAME 60s window, so the second run inherits the first
// run's counts and legitimate requests start getting a real 429 —
// found by actually running the suite twice in a row. Clearing only
// the ratelimit:* keys (not flushdb) avoids disturbing anything else
// that might share this Redis instance (e.g. BullMQ).
export default async function globalSetup() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1
  });

  try {
    const keys = await redis.keys("ratelimit:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } finally {
    redis.disconnect();
  }
}
