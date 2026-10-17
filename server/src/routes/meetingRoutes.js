import { Router } from "express";

import { protect } from "../middleware/protect.js";

import {
  createMeeting,
  getMyMeetings,
  getMeetingById,
  startMeeting,
  endMeeting,
  cancelMeeting,
} from "../controllers/meetingController.js";

const router = Router();

// Every meeting endpoint requires authentication.
router.use(protect);

router.post("/", createMeeting);
router.get("/", getMyMeetings);

router.get("/:meetingId", getMeetingById);
router.patch("/:meetingId/start", startMeeting);
router.patch("/:meetingId/end", endMeeting);
router.patch("/:meetingId/cancel", cancelMeeting);

export default router;
