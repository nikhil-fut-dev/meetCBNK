import { getDatabaseStatus } from "../config/db.js";

export function getHealth(req, res) {
  const databaseState = getDatabaseStatus();
  const databaseConnected = databaseState === 1;

  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    service: "MeetSphere API",
    status: databaseConnected ? "healthy" : "database_unavailable",
    database: databaseConnected ? "connected" : "not_connected",
    timestamp: new Date().toISOString(),
  });
}
