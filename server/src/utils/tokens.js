import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ACCESS_COOKIE_NAME = "ms_access";
const REFRESH_COOKIE_NAME = "ms_refresh";

export function generateAccessToken(userId) {
  return jwt.sign(
    { sub: userId.toString(), type: "access" },
    env.accessTokenSecret,
    {
      expiresIn: env.accessTokenExpiresIn,
      issuer: "meetsphere-api",
      audience: "meetsphere-client",
    },
  );
}

export function generateRefreshToken(userId) {
  return jwt.sign(
    { sub: userId.toString(), type: "refresh" },
    env.refreshTokenSecret,
    {
      expiresIn: env.refreshTokenExpiresIn,
      issuer: "meetsphere-api",
      audience: "meetsphere-client",
    },
  );
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.accessTokenSecret, {
    issuer: "meetsphere-api",
    audience: "meetsphere-client",
  });

  if (
    typeof payload === "string" ||
    payload.type !== "access" ||
    typeof payload.sub !== "string"
  ) {
    throw new Error("Invalid access token");
  }

  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.refreshTokenSecret, {
    issuer: "meetsphere-api",
    audience: "meetsphere-client",
  });

  if (
    typeof payload === "string" ||
    payload.type !== "refresh" ||
    typeof payload.sub !== "string"
  ) {
    throw new Error("Invalid refresh token");
  }

  return payload;
}

function cookieBaseOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/",
  };
}

export function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...cookieBaseOptions(),
    maxAge: 15 * 60 * 1000,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...cookieBaseOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, cookieBaseOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, cookieBaseOptions());
}

export { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME };
