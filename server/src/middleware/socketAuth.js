import User from "../models/User.js";
import { verifyAccessToken } from "../utils/tokens.js";

function getCookieValue(cookieHeader, cookieName) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();

    if (name === cookieName) {
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    }
  }

  return null;
}

export async function socketAuth(socket, next) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const token = getCookieValue(cookieHeader, "ms_access");

    if (!token) {
      return next(new Error("Authentication required."));
    }

    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(new Error("Invalid or expired access token."));
    }

    if (!payload?.sub) {
      return next(new Error("Invalid access token payload."));
    }

    const user = await User.findById(payload.sub)
      .select("_id fullName username email isActive")
      .lean();

    if (!user || !user.isActive) {
      return next(new Error("User account is unavailable."));
    }

    socket.data.user = {
      id: user._id.toString(),
      fullName: user.fullName,
      username: user.username,
    };

    return next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    return next(new Error("Socket authentication failed."));
  }
}
