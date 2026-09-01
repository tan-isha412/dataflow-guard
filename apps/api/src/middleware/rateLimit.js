import { AppError } from "./errorHandler.js";
import { redisClient } from "../config/redis.js";

// A factory, same shape as requirePermission — rateLimit({...})
// returns a middleware configured with these specific limits.
export function rateLimit({ windowSeconds = 60, max = 100 } = {}) {
  return async (req, res, next) => {
    const key = `ratelimit:${req.auth?.organizationId ?? req.ip}`;

    try {
      const count = await redisClient.incr(key);
      // Only set the expiry on the FIRST request in a fresh window —
      // otherwise a constantly-active caller would keep pushing the
      // reset time forward and the limit would never actually reset.
      if (count === 1) {
        await redisClient.expire(key, windowSeconds);
      }

      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(Math.max(0, max - count)));

      if (count > max) {
        return next(new AppError("Too many requests, please slow down", 429, "RATE_LIMITED"));
      }
      next();
    } catch (err) {
      // If Redis itself is down, fail OPEN (let the request through)
      // rather than blocking the entire API — a rate limiter that
      // takes down the whole product when its dependency hiccups is
      // a worse outcome than temporarily unlimited requests.
      console.error("Rate limiter error, allowing request through:", err.message);
      next();
    }
  };
}