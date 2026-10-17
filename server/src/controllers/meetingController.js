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

  return id;
}

function publicMeeting(meeting) {
  return {
    id: meeting._id.toString(),
    title: meeting.title,
    meetingCode: meeting.meetingCode,
    host: meeting.host.toString(),

    participants: meeting.participants.map((participant) => ({
      user:
        participant.user?._id?.toString?.() ?? participant.user?.toString?.(),
      role: participant.role,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
    })),

    status: meeting.status,
    scheduledAt: meeting.scheduledAt,
    startedAt: meeting.startedAt,
    endedAt: meeting.endedAt,
    maxParticipants: meeting.maxParticipants,

    settings: {
      allowChat: meeting.settings?.allowChat ?? true,
      allowScreenShare: meeting.settings?.allowScreenShare ?? true,
    },

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
    participants: [],
    status: "scheduled",
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

/**
 * GET /api/v1/meetings/schedules
 * Return the current user's meeting schedules.
 */
export const getMySchedules = asyncHandler(async (req, res) => {
  const schedules = await MeetingSchedule.find({
    host: req.user._id,
  })
    .sort({ scheduledAt: 1 })
    .limit(100)
    .populate({
      path: "meeting",
      select: "title meetingCode status scheduledAt startedAt endedAt",
    })
    .lean();

  const safeSchedules = schedules.map((schedule) => ({
    id: schedule._id.toString(),
    meeting: schedule.meeting
      ? {
          id: schedule.meeting._id.toString(),
          title: schedule.meeting.title,
          meetingCode: schedule.meeting.meetingCode,
          status: schedule.meeting.status,
          scheduledAt: schedule.meeting.scheduledAt,
          startedAt: schedule.meeting.startedAt,
          endedAt: schedule.meeting.endedAt,
        }
      : null,
    title: schedule.title,
    description: schedule.description,
    scheduledAt: schedule.scheduledAt,
    durationMinutes: schedule.durationMinutes,
    status: schedule.status,
    createdAt: schedule.createdAt,
  }));

  return res.status(200).json({
    success: true,
    count: safeSchedules.length,
    schedules: safeSchedules,
  });
});

// GET /api/v1/meetings/:meetingId

export const getMeetingById = asyncHandler(async (req, res) => {
  const meetingId = parseMeetingId(req.params.meetingId);

  const meeting = await Meeting.findById(meetingId);

  if (!meeting) {
    throw new ApiError(404, "Meeting not found.");
  }

  const isHost = meeting.host.toString() === req.user._id.toString();

  const participant = meeting.participants.find(
    (item) => item.user.toString() === req.user._id.toString(),
  );

  const isActiveParticipant = Boolean(participant && !participant.leftAt);

  if (!isHost && !isActiveParticipant) {
    throw new ApiError(403, "You do not have permission to view this meeting.");
  }

  return res.status(200).json({
    success: true,
    meeting: publicMeeting(meeting),
  });
});

// PATCH /api/v1/meetings/:meetingId/start
export const startMeeting = asyncHandler(async (req, res) => {
  const meetingId = parseMeetingId(req.params.meetingId);

  const meeting = await Meeting.findOne({
    _id: meetingId,
    host: req.user._id,
  });

  if (!meeting) {
    throw new ApiError(404, "Meeting not found.");
  }

  if (meeting.status !== "scheduled") {
    throw new ApiError(409, "Only scheduled meetings can be started.");
  }

  const now = new Date();

  const hostParticipant = meeting.participants.find((participant) =>
    participant.user.equals(req.user._id),
  );

  if (hostParticipant) {
    hostParticipant.role = "host";
    hostParticipant.joinedAt = now;
    hostParticipant.leftAt = null;
  } else {
    meeting.participants.push({
      user: req.user._id,
      role: "host",
      joinedAt: now,
      leftAt: null,
    });
  }

  meeting.status = "live";
  meeting.startedAt = now;
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
  const meetingId = parseMeetingId(req.params.meetingId);

  const meeting = await Meeting.findOne({
    _id: meetingId,
    host: req.user._id,
  });

  if (!meeting) {
    throw new ApiError(404, "Meeting not found or access denied.");
  }

  if (meeting.status !== "live") {
    throw new ApiError(409, "Only a live meeting can be ended.");
  }

  const now = new Date();

  meeting.status = "ended";
  meeting.endedAt = now;

  // Mark all active participants as having left.
  for (const participant of meeting.participants) {
    if (!participant.leftAt) {
      participant.leftAt = now;
    }
  }

  await meeting.save();

  // Update the associated schedule, if one exists.
  await MeetingSchedule.findOneAndUpdate(
    { meeting: meeting._id },
    { status: "completed" },
  );

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

/**
 * POST /api/v1/meetings/join
 * Body: { "meetingCode": "..." }
 */
export const joinMeeting = asyncHandler(async (req, res) => {
  const { meetingCode } = req.body ?? {};

  // 1. Validate the meeting code.
  if (typeof meetingCode !== "string") {
    throw new ApiError(400, "A valid meeting code is required.");
  }

  const normalizedCode = meetingCode.trim().toLowerCase();

  if (!meetingCodePattern.test(normalizedCode)) {
    throw new ApiError(400, "A valid meeting code is required.");
  }

  // 2. Find the meeting.
  const meeting = await Meeting.findOne({
    meetingCode: normalizedCode,
  });

  if (!meeting) {
    throw new ApiError(404, "Meeting not found.");
  }

  const isHost = meeting.host.equals(req.user._id);

  // 3. Reject meetings that cannot be joined.
  if (["ended", "cancelled"].includes(meeting.status)) {
    throw new ApiError(409, "This meeting has ended or been cancelled.");
  }

  if (!isHost && meeting.status !== "live") {
    throw new ApiError(
      409,
      "This meeting is not currently accepting participants.",
    );
  }

  // 4. Check whether the user already has a participant record.
  const existingParticipant = meeting.participants.find((participant) =>
    participant.user.equals(req.user._id),
  );

  // Handle an already-active participant.
  if (existingParticipant && !existingParticipant.leftAt) {
    // If the host is active but the meeting is still scheduled,
    // ensure the meeting is started.
    if (isHost && meeting.status === "scheduled") {
      meeting.status = "live";
      meeting.startedAt = new Date();

      await meeting.save();

      return res.status(200).json({
        success: true,
        message: "Meeting started successfully.",
        meeting: publicMeeting(meeting),
      });
    }

    return res.status(200).json({
      success: true,
      message: "You are already in this meeting.",
      meeting: publicMeeting(meeting),
    });
  }

  // 5. Count active participants.
  const activeParticipants = meeting.participants.filter(
    (participant) => !participant.leftAt,
  );

  const hostAlreadyActive = activeParticipants.some((participant) =>
    participant.user.equals(meeting.host),
  );

  const hostJoining = isHost && !hostAlreadyActive;

  if (activeParticipants.length >= meeting.maxParticipants && !hostJoining) {
    throw new ApiError(409, "Meeting is full.");
  }

  const now = new Date();

  // 6. Reactivate an existing record or create a new one.
  if (existingParticipant) {
    existingParticipant.joinedAt = now;
    existingParticipant.leftAt = null;
    existingParticipant.role = isHost ? "host" : "participant";
  } else {
    meeting.participants.push({
      user: req.user._id,
      role: isHost ? "host" : "participant",
      joinedAt: now,
      leftAt: null,
    });
  }

  // 7. Automatically start when the host joins.
  if (isHost && meeting.status === "scheduled") {
    meeting.status = "live";
    meeting.startedAt = now;
    meeting.endedAt = null;
  }

  // 8. Save changes.
  await meeting.save();

  return res.status(200).json({
    success: true,
    message: isHost
      ? "You joined the meeting successfully."
      : "Meeting joined successfully.",
    meeting: publicMeeting(meeting),
  });
});

/**
 * POST /api/v1/meetings/:meetingId/leave
 */
export const leaveMeeting = asyncHandler(async (req, res) => {
  const meetingId = parseMeetingId(req.params.meetingId);

  const meeting = await Meeting.findById(meetingId);

  if (!meeting) {
    throw new ApiError(404, "Meeting not found.");
  }

  const participant = meeting.participants.find(
    (item) => item.user.toString() === req.user._id.toString() && !item.leftAt,
  );

  if (!participant) {
    throw new ApiError(409, "You are not an active participant.");
  }

  const now = new Date();
  const isHost = meeting.host.toString() === req.user._id.toString();

  if (isHost && meeting.status === "live") {
    // MVP rule: when the host leaves, the meeting ends.
    meeting.status = "ended";
    meeting.endedAt = now;

    for (const item of meeting.participants) {
      if (!item.leftAt) {
        item.leftAt = now;
      }
    }
  } else {
    // A normal participant leaves without ending the meeting.
    participant.leftAt = now;
  }

  await meeting.save();

  await MeetingSchedule.findOneAndUpdate(
    { meeting: meeting._id },
    { status: "completed" },
  );

  return res.status(200).json({
    success: true,
    message:
      isHost && meeting.status === "ended"
        ? "Host left. Meeting has ended."
        : "You left the meeting successfully.",
    meeting: publicMeeting(meeting),
  });
});
