import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";

import { requestLogger } from "./middleware/requestLogger.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Hide Express technology information.
app.disable("x-powered-by");

// Add security-related HTTP headers.
app.use(helmet());

// Allow requests from the configured frontend.
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);

// Parse incoming JSON and form data.
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

// Read cookies sent by the client.
app.use(cookieParser());

// Log incoming requests.
app.use(requestLogger);

// API welcome route.
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to MeetSphere API",
  });
});

// Health check route.
app.use("/api/v1/health", healthRoutes);

// Authentication routes.
app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/meetings", meetingRoutes);

// Keep these middleware at the end.
app.use(notFound);
app.use(errorHandler);

export default app;
