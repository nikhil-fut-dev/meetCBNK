import http from "node:http";
import { Server } from "socket.io";

import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { socketAuth } from "./middleware/socketAuth.js";
import { registerMeetingSocket } from "./sockets/meetingSocket.js";

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.clientUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Authenticate every Socket.IO connection.
io.use(socketAuth);

registerMeetingSocket(io);

io.on("connection", (socket) => {
  console.log(
    `Authenticated socket connected: ${socket.data.user.username} (${socket.id})`,
  );

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

async function startServer() {
  await connectDatabase();

  httpServer.listen(env.port, () => {
    console.log(`MeetCBNK API running on port ${env.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  io.close(() => {
    console.log("Socket.IO connections closed.");
  });

  httpServer.close(async () => {
    try {
      const mongoose = await import("mongoose");
      await mongoose.default.disconnect();
      console.log("MongoDB disconnected.");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

startServer().catch((error) => {
  console.error("Failed to start MeetSphere:", error);
  process.exit(1);
});
