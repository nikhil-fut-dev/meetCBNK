import dotenv from "dotenv";

dotenv.config();

const requiredVariables = [
  "MONGODB_URI",
  "CLIENT_URL",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
];

for (const variable of requiredVariables) {
  if (!process.env[variable]?.trim()) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

if (process.env.ACCESS_TOKEN_SECRET === process.env.REFRESH_TOKEN_SECRET) {
  throw new Error("Access and refresh token secrets must be different.");
}

if (
  process.env.ACCESS_TOKEN_SECRET.length < 32 ||
  process.env.REFRESH_TOKEN_SECRET.length < 32
) {
  throw new Error("JWT secrets must be at least 32 characters long.");
}

const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid port number.");
}

const cookieSecure = process.env.COOKIE_SECURE === "true";

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  port,
  clientUrl: process.env.CLIENT_URL,
  mongoUri: process.env.MONGODB_URI,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  cookieSecure,
});
