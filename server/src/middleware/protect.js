import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { ApiError } from "../utils/ApiError.js";

export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.ms_access;

  if (!token) {
    throw new ApiError(401, "Authentication required. Please log in.");
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired access token.");
  }

  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    throw new ApiError(401, "User account is unavailable.");
  }

  req.user = user;

  next();
});
