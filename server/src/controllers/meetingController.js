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

/**
 * PATCH /api/v1/meetings/:meetingId/start
 */
export const startMeeting = asyncHandler(async (req, res) => {
  const meetingId = parseMeetingId(req.params.meetingId);

  const now = new Date();

  // Atomic status check prevents starting the same meeting twice.
  const meeting = await Meeting.findOneAndUpdate(
    {
      _id: meetingId,
      host: req.user._id,
      status: "scheduled",
    },
    {
      $set: {
        status: "live",
        startedAt: now,
        endedAt: null,
      },
    },
    { new: true },
  );

  if (!meeting) {
    const existingMeeting = await Meeting.findById(meetingId);

    if (!existingMeeting) {
      throw new ApiError(404, "Meeting not found.");
    }

    if (!existingMeeting.host.equals(req.user._id)) {
      throw new ApiError(403, "Only the host can start this meeting.");
    }

    throw new ApiError(409, "Only scheduled meetings can be started.");
  }

  // Add or reactivate the host participant record.
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
    {
      meeting: meeting._id,
      status: { $ne: "cancelled" },
    },
    {
      $set: { status: "completed" },
    },
  );

  return res.status(200).json({
    success: true,
    message: "Meeting ended successfully.",
    meeting: publicMeeting(meeting),
  });
});

/**
 * PATCH /api/v1/meetings/:meetingId/cancel
 */
export const cancelMeeting = asyncHandler(async (req, res) => {
  const meetingId = parseMeetingId(req.params.meetingId);

  const meeting = await Meeting.findOne({
    _id: meetingId,
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
    {
      meeting: meeting._id,
      host: req.user._id,
      status: "scheduled",
    },
    {
      $set: { status: "cancelled" },
    },
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

  if (typeof meetingCode !== "string") {
    throw new ApiError(400, "A valid meeting code is required.");
  }

  const normalizedCode = meetingCode.trim().toLowerCase();

  if (!meetingCodePattern.test(normalizedCode)) {
    throw new ApiError(400, "A valid meeting code is required.");
  }

  const userId = req.user._id;

  // Find the meeting before attempting the atomic update.
  const meeting = await Meeting.findOne({
    meetingCode: normalizedCode,
  });

  if (!meeting) {
    throw new ApiError(404, "Meeting not found.");
  }

  const isHost = meeting.host.equals(userId);

  if (["ended", "cancelled"].includes(meeting.status)) {
    throw new ApiError(409, "This meeting has ended or been cancelled.");
  }

  if (!isHost && meeting.status !== "live") {
    throw new ApiError(
      409,
      "This meeting is not currently accepting participants.",
    );
  }

  const existingParticipant = meeting.participants.find((participant) =>
    participant.user.equals(userId),
  );

  // An already-active user can retry without consuming another slot.
  if (existingParticipant && !existingParticipant.leftAt) {
    return res.status(200).json({
      success: true,
      message: "You are already in this meeting.",
      meeting: publicMeeting(meeting),
    });
  }

  const now = new Date();

  const participantData = {
    user: userId,
    role: isHost ? "host" : "participant",
    joinedAt: now,
    leftAt: null,
  };

  /*
   * Count active participants inside MongoDB.
   * The capacity condition and participant update are atomic
   * because they operate on the same meeting document.
   */
  const activeParticipantsExpression = {
    $filter: {
      input: { $ifNull: ["$participants", []] },
      as: "participant",
      cond: {
        $eq: [{ $ifNull: ["$$participant.leftAt", null] }, null],
      },
    },
  };

  const updatedMeeting = await Meeting.findOneAndUpdate(
    {
      _id: meeting._id,

      // A host may start a scheduled meeting; others join live meetings.
      status: isHost ? { $in: ["scheduled", "live"] } : "live",

      $expr: {
        $or: [
          // Allow an existing active user to retry safely.
          {
            $in: [
              userId,
              {
                $map: {
                  input: activeParticipantsExpression,
                  as: "participant",
                  in: "$$participant.user",
                },
              },
            ],
          },

          // Otherwise, a free participant slot must exist.
          {
            $lt: [{ $size: activeParticipantsExpression }, "$maxParticipants"],
          },
        ],
      },
    },

    [
      {
        $set: {
          participants: {
            $cond: [
              {
                $in: [
                  userId,
                  {
                    $map: {
                      input: { $ifNull: ["$participants", []] },
                      as: "participant",
                      in: "$$participant.user",
                    },
                  },
                ],
              },

              // Reactivate the user's existing participant record.
              {
                $map: {
                  input: { $ifNull: ["$participants", []] },
                  as: "participant",
                  in: {
                    $cond: [
                      { $eq: ["$$participant.user", userId] },
                      {
                        $mergeObjects: ["$$participant", participantData],
                      },
                      "$$participant",
                    ],
                  },
                },
              },

              // Add a new participant when no record exists.
              {
                $concatArrays: [
                  { $ifNull: ["$participants", []] },
                  [participantData],
                ],
              },
            ],
          },

          status: {
            $cond: [
              {
                $and: [
                  { $eq: ["$host", userId] },
                  { $eq: ["$status", "scheduled"] },
                ],
              },
              "live",
              "$status",
            ],
          },

          startedAt: {
            $cond: [
              {
                $and: [
                  { $eq: ["$host", userId] },
                  { $eq: ["$status", "scheduled"] },
                ],
              },
              now,
              "$startedAt",
            ],
          },

          endedAt: {
            $cond: [
              {
                $and: [
                  { $eq: ["$host", userId] },
                  { $eq: ["$status", "scheduled"] },
                ],
              },
              null,
              "$endedAt",
            ],
          },
        },
      },
    ],

    { new: true },
  );

  if (!updatedMeeting) {
    // Re-read to return the appropriate error for a concurrent change.
    const latestMeeting = await Meeting.findById(meeting._id);

    if (!latestMeeting) {
      throw new ApiError(404, "Meeting not found.");
    }

    if (["ended", "cancelled"].includes(latestMeeting.status)) {
      throw new ApiError(409, "This meeting has ended or been cancelled.");
    }

    if (!isHost && latestMeeting.status !== "live") {
      throw new ApiError(
        409,
        "This meeting is not currently accepting participants.",
      );
    }

    throw new ApiError(
      409,
      "Meeting is full or your join request conflicted. Please try again.",
    );
  }

  return res.status(200).json({
    success: true,
    message: isHost
      ? "You joined the meeting successfully."
      : "Meeting joined successfully.",
    meeting: publicMeeting(updatedMeeting),
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

  const userId = req.user._id;
  const isHost = meeting.host.equals(userId);

  const participant = meeting.participants.find(
    (item) => item.user.equals(userId) && !item.leftAt,
  );

  if (!participant) {
    throw new ApiError(409, "You are not an active participant.");
  }

  if (meeting.status !== "live") {
    throw new ApiError(409, "Only participants in a live meeting can leave.");
  }

  const now = new Date();

  if (isHost) {
    // Host leaving ends the live meeting.
    meeting.status = "ended";
    meeting.endedAt = now;

    for (const item of meeting.participants) {
      if (!item.leftAt) {
        item.leftAt = now;
      }
    }
  } else {
    // A normal participant leaving does not end the meeting.
    participant.leftAt = now;
  }

  await meeting.save();

  // Only update the schedule when the meeting actually ended.
  if (isHost) {
    await MeetingSchedule.updateOne(
      {
        meeting: meeting._id,
        status: { $ne: "cancelled" },
      },
      {
        $set: { status: "completed" },
      },
    );
  }

  return res.status(200).json({
    success: true,
    message: isHost
      ? "Host left. Meeting has ended."
      : "You left the meeting successfully.",
    meeting: publicMeeting(meeting),
  });
});
