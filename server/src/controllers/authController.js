import crypto from "node:crypto";

import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  REFRESH_COOKIE_NAME,
} from "../utils/tokens.js";

// Store only a SHA-256 hash of the refresh token in MongoDB.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Return only safe, public user fields.
function publicUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt,
  };
}

// Create a new access token and rotate the refresh token.
async function issueAuthTokens(user, res) {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  setAuthCookies(res, accessToken, refreshToken);
}

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body ?? {};

  if (
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    throw new ApiError(400, "Full name, email, and password are required.");
  }

  const cleanName = fullName.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2 || cleanName.length > 80) {
    throw new ApiError(400, "Full name must be between 2 and 80 characters.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new ApiError(400, "Please provide a valid email address.");
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new ApiError(
      400,
      "Password must be at least 8 characters and no more than 72 UTF-8 bytes.",
    );
  }

  const existingUser = await User.findOne({ email: cleanEmail });

  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  // Never accept role or refreshTokenHash from public registration input.
  const user = await User.create({
    fullName: cleanName,
    email: cleanEmail,
    password,
  });

  await issueAuthTokens(user, res);

  return res.status(201).json({
    success: true,
    message: "Account created successfully.",
    user: publicUser(user),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    throw new ApiError(400, "Email and password are required.");
  }

  const cleanEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: cleanEmail }).select(
    "+password +refreshTokenHash",
  );

  // Use the same error for unknown email and wrong password.
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (!user.isActive) {
    throw new ApiError(403, "This account has been deactivated.");
  }

  await issueAuthTokens(user, res);

  return res.status(200).json({
    success: true,
    message: "Login successful.",
    user: publicUser(user),
  });
});

export const me = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    user: publicUser(req.user),
  });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  // Logout should clear cookies even if the token is missing or expired.
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);

      const user = await User.findById(payload.sub).select("+refreshTokenHash");

      if (
        user?.refreshTokenHash &&
        user.refreshTokenHash === hashToken(refreshToken)
      ) {
        user.refreshTokenHash = null;
        await user.save();
      }
    } catch {
      // An invalid/expired token cannot authenticate a session for revocation.
      // Cookies are still cleared below.
    }
  }

  clearAuthCookies(res);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    clearAuthCookies(res);
    throw new ApiError(401, "Refresh token missing. Please log in again.");
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    clearAuthCookies(res);
    throw new ApiError(401, "Refresh token is invalid or expired.");
  }

  const user = await User.findById(payload.sub).select("+refreshTokenHash");

  if (
    !user ||
    !user.isActive ||
    !user.refreshTokenHash ||
    user.refreshTokenHash !== hashToken(refreshToken)
  ) {
    clearAuthCookies(res);
    throw new ApiError(401, "Session is no longer valid. Please log in again.");
  }

  // Rotate the refresh token so the old token cannot be reused.
  await issueAuthTokens(user, res);

  return res.status(200).json({
    success: true,
    message: "Session refreshed successfully.",
    user: publicUser(user),
  });
});
