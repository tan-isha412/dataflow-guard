import Redis from "ioredis";
import { env } from "./env.js";

// One shared Redis connection, same principle as db.js's single
// Prisma client — every file that needs Redis imports this instance.
export const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null // required by BullMQ's connection requirements
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});