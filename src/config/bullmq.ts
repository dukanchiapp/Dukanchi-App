import IORedis from "ioredis";
import { Queue } from "bullmq";
import { env } from "./env";

// IORedis connection dedicated for BullMQ
export const bullRedisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Setup BullMQ queues
export const notificationQueue = new Queue('Notifications', { connection: bullRedisConnection });
