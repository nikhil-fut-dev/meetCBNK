import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

// Remove the API path to get the Socket.IO server origin.
const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, "");

export function createMeetingSocket() {
  return io(SOCKET_URL, {
    withCredentials: true,
    autoConnect: false,
  });
}
