import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let message = "Internal server error.";

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err?.code === 11000) {
    statusCode = 409;
    message = "A record with this information already exists.";
  } else if (err?.name === "ValidationError" || err?.name === "CastError") {
    statusCode = 400;
    message =
      err.name === "ValidationError"
        ? Object.values(err.errors)
            .map((item) => item.message)
            .join(", ")
        : "Invalid resource identifier.";
  } else if (err?.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body is too large.";
  } else if (err?.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON request body.";
  } else if (env.nodeEnv !== "production" && err?.message) {
    message = err.message;
  }

  if (statusCode >= 500) {
    console.error("Server error:", err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
}
