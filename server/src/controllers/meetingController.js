import mongoose from "mongoose";

import Meeting from "../models/Meeting.js";
import MeetingSchedule from "../models/MeetingSchedule.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const meetingCodePattern = /^[a-f0-9]{12}$/;

function parseMeetingId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid meeting ID.");
  }
}

function publicMeeting(meeting) {
  return {
    id: meeting._id.toString(),
    title: meeting.title,
    meetingCode: meeting.meetingCode,
    host: meeting.host,
    participants: meeting.participants,
    status: meeting.status,
    scheduledAt: meeting.scheduledAt,
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
    maxParticipants: meeting.maxParticipants,
    settings: meeting.settings,
    createdAt: meeting.createdAt,
  };
}

// POST /api/v1/meetings
export const createMeeting = asyncHandler(async (req, res) => {
  const { title, scheduledAt, maxParticipants, settings } = req.body ?? {};

  if (typeof title !== "string" || title.trim().length < 3) {
    throw new ApiError(400, "Meeting title must be at least 3 characters.");
  }

  if (title.trim().length > 100) {
    throw new ApiError(400, "Meeting title cannot exceed 100 characters.");
  }

  let parsedSchedule = null;

  if (scheduledAt !== undefined && scheduledAt !== null && scheduledAt !== "") {
    parsedSchedule = new Date(scheduledAt);

    if (Number.isNaN(parsedSchedule.getTime())) {
      throw new ApiError(400, "Invalid scheduled date and time.");
    }

    if (parsedSchedule <= new Date()) {
      throw new ApiError(400, "Scheduled time must be in the future.");
    }
  }

  const capacity = maxParticipants === undefined ? 10 : Number(maxParticipants);

  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 10) {
    throw new ApiError(400, "Meeting capacity must be between 2 and 10.");
  }

  const safeSettings = {};

  if (settings !== undefined) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      throw new ApiError(400, "Settings must be an object.");
    }

    for (const key of ["allowChat", "allowScreenShare"]) {
      if (settings[key] !== undefined && typeof settings[key] !== "boolean") {
        throw new ApiError(400, `${key} must be true or false.`);
      }
    }

    if (settings.allowChat !== undefined) {
      safeSettings.allowChat = settings.allowChat;
    }

    if (settings.allowScreenShare !== undefined) {
      safeSettings.allowScreenShare = settings.allowScreenShare;
    }
  }

  const meeting = await Meeting.create({
    title: title.trim(),
    host: req.user._id,
    participants: [{ user: req.user._id, role: "host" }],
    status: parsedSchedule ? "scheduled" : "scheduled",
    scheduledAt: parsedSchedule,
    maxParticipants: capacity,
    settings: safeSettings,
  });

  if (parsedSchedule) {
    try {
      await MeetingSchedule.create({
        meeting: meeting._id,
        host: req.user._id,
        title: meeting.title,
        scheduledAt: parsedSchedule,
        durationMinutes: 30,
      });
    } catch (error) {
      // Avoid leaving a meeting without its schedule record.
      await Meeting.deleteOne({ _id: meeting._id });
      throw error;
    }
  }

  return res.status(201).json({
    success: true,
    message: parsedSchedule
      ? "Meeting scheduled successfully."
      : "Meeting created successfully.",
    meeting: publicMeeting(meeting),
  });
});

// GET /api/v1/meetings
export const getMyMeetings = asyncHandler(async (req, res) => {
  const meetings = await Meeting.find({ host: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return res.status(200).json({
    success: true,
    count: meetings.length,
    meetings: meetings.map(publicMeeting),
  });
});

// GET /api/v1/meetings/:meetingId
export const getMeetingById = asyncHandler(async (req, res) => {
  parseMeetingId(req.params.meetingId);

  const meeting = await Meeting.findOne({
    _id: req.params.meetingId,
    host: req.user._id,
  });

  if (!meeting) {
    throw new ApiError(404, "Meeting not found.");
  }

  return res.status(200).json({
    success: true,
    meeting: publicMeeting(meeting),
  });
});

// PATCH /api/v1/meetings/:meetingId/start
export const startMeeting = asyncHandler(async (req, res) => {
  parseMeetingId(req.params.meetingId);

  const meeting = await Meeting.findOne({
    _id: req.params.meetingId,
    host: req.user._id,
  });

  if (!meeting) {
    throw new ApiError(404, "Meeting not found.");
  }

  if (meeting.status !== "scheduled") {
    throw new ApiError(409, "Only scheduled meetings can be started.");
  }

  meeting.status = "live";
  meeting.startedAt = new Date();
  meeting.endedAt = null;

  await meeting.save();

  return res.status(200).json({
    success: true,
    message: "Meeting started successfully.",
    meeting: publicMeeting(meeting),
  });
});

// PATCH /api/v1/meetings/:meetingId/end
export const endMeeting = asyncHandler(async (req, res) => {
  parseMeetingId(req.params.meetingId);

  const meeting = await Meeting.findOne({
    _id: req.params.meetingId,
    host: req.user._id,
  });

  if (!meeting) {
    throw new ApiError(404, "Meeting not found.");
  }

  if (meeting.status !== "live") {
    throw new ApiError(409, "Only live meetings can be ended.");
  }

  meeting.status = "ended";
  meeting.endedAt = new Date();

  await meeting.save();

  return res.status(200).json({
    success: true,
    message: "Meeting ended successfully.",
    meeting: publicMeeting(meeting),
  });
});

// PATCH /api/v1/meetings/:meetingId/cancel
export const cancelMeeting = asyncHandler(async (req, res) => {
  parseMeetingId(req.params.meetingId);

  const meeting = await Meeting.findOne({
    _id: req.params.meetingId,
    host: req.user._id,
  });

  if (!meeting) {
    throw new ApiError(404, "Meeting not found.");
  }

  if (meeting.status !== "scheduled") {
    throw new ApiError(409, "Only scheduled meetings can be cancelled.");
  }

  meeting.status = "cancelled";
  await meeting.save();

  await MeetingSchedule.updateOne(
    { meeting: meeting._id, host: req.user._id },
    { $set: { status: "cancelled" } },
  );

  return res.status(200).json({
    success: true,
    message: "Meeting cancelled successfully.",
    meeting: publicMeeting(meeting),
  });
});
