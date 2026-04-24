import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { pubClient, subClient } from "./redis";
import { getAllowedOrigins, env } from "./env";

let io: Server;

export const initializeSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: { origin: getAllowedOrigins() },
  });

  io.adapter(createAdapter(pubClient, subClient));
  if (env.NODE_ENV !== 'production') {
    console.log("✅ Redis adapter attached to Socket.IO");
  }

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
