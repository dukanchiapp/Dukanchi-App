import { createClient } from "redis";
import { env } from "./env";

export const pubClient = createClient({ url: env.REDIS_URL });
export const subClient = pubClient.duplicate();

// Prevent unhandled 'error' events from crashing the process when Redis is unavailable
pubClient.on('error', (err) => console.error('Redis pubClient error:', err.message));
subClient.on('error', (err) => console.error('Redis subClient error:', err.message));

export const connectRedis = async () => {
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    if (env.NODE_ENV !== 'production') console.log("✅ Redis pub/sub clients connected");
  } catch (err) {
    console.error("❌ Redis connection failed — app will continue without caching:", err);
  }
};
