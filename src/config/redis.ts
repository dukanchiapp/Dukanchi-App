import { createClient } from "redis";
import { env } from "./env";

export const pubClient = createClient({ url: env.REDIS_URL });
export const subClient = pubClient.duplicate();

export const connectRedis = async () => {
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    if (env.NODE_ENV !== 'production') console.log("✅ Redis pub/sub clients connected");
  } catch (err) {
    console.error("❌ Redis connection error:", err);
  }
};
