import { Router } from "express";
import { protect } from "../middleware/protect.js";

import {
  createMeeting,
  getMyMeetings,
  getMySchedules,
  getMeetingById,
  startMeeting,
  endMeeting,
  cancelMeeting,
  joinMeeting,
  leaveMeeting,
} from "../controllers/meetingController.js";

const router = Router();

router.use(protect);

router.post("/", createMeeting);
router.get("/", getMyMeetings);

// Join using the meeting code.
router.post("/join", joinMeeting);

// Meeting details and lifecycle.
router.get("/schedules", getMySchedules);
router.get("/:meetingId", getMeetingById);
router.patch("/:meetingId/start", startMeeting);
router.patch("/:meetingId/end", endMeeting);
router.patch("/:meetingId/cancel", cancelMeeting);

// Leave a meeting by its MongoDB ID.
router.post("/:meetingId/leave", leaveMeeting);

export default router;
