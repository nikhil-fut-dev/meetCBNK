import mongoose from "mongoose";
import Meeting from "../models/Meeting.js";
import ChatMessage from "../models/ChatMessage.js";

function getRoomName(meetingId) {
  return `meeting:${meetingId}`;
}

function sendError(socket, acknowledge, message) {
  const response = {
    success: false,
    message,
  };

  if (typeof acknowledge === "function") {
    acknowledge(response);
  } else {
    socket.emit("meeting:error", response);
  }
}

function isValidMeetingId(meetingId) {
  return typeof meetingId === "string" && mongoose.isValidObjectId(meetingId);
}

function isHost(meeting, userId) {
  return meeting.host?.toString() === userId;
}

function isActiveParticipant(meeting, userId) {
  return meeting.participants?.some(
    (participant) =>
      participant.user?.toString() === userId && !participant.leftAt,
  );
}

function isMeetingMember(meeting, userId) {
  return (
    isHost(meeting, userId) ||
    meeting.participants?.some(
      (participant) => participant.user?.toString() === userId,
    )
  );
}

function getSenderPayload(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
  };
}

function createSocketRateLimiter({ maxEvents = 10, windowMs = 10000 } = {}) {
  const userEvents = new Map();

  return function isRateLimited(userId, eventName) {
    const now = Date.now();
    const key = `${userId}:${eventName}`;

    const timestamps = (userEvents.get(key) ?? []).filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (timestamps.length >= maxEvents) {
      userEvents.set(key, timestamps);
      return true;
    }

    timestamps.push(now);
    userEvents.set(key, timestamps);

    return false;
  };
}

export function registerMeetingSocket(io) {
  // In-memory presence state for active meetings.
  // Map<meetingId, Map<userId, participantState>>
  const meetingPresence = new Map();

  function getMeetingPresence(meetingId) {
    if (!meetingPresence.has(meetingId)) {
      meetingPresence.set(meetingId, new Map());
    }

    return meetingPresence.get(meetingId);
  }

  function getConnectedUserIds(io, roomName) {
    return io
      .in(roomName)
      .fetchSockets()
      .then((sockets) => {
        return [
          ...new Set(sockets.map((item) => item.data.user?.id).filter(Boolean)),
        ];
      });
  }

  const isRateLimited = createSocketRateLimiter();

  io.on("connection", (socket) => {
    // Store complete room names, for example: meeting:65abc...
    const joinedRooms = new Set();

    /*
    ============================================================
    1. JOIN MEETING ROOM
    ============================================================
    */

    socket.on("meeting:join", async (payload = {}, acknowledge) => {
      try {
        const { meetingId } = payload;

        if (!isValidMeetingId(meetingId)) {
          return sendError(
            socket,
            acknowledge,
            "A valid meeting ID is required.",
          );
        }

        const meeting = await Meeting.findById(meetingId)
          .select("host participants status")
          .lean();

        if (!meeting) {
          return sendError(socket, acknowledge, "Meeting not found.");
        }

        if (meeting.status !== "live") {
          return sendError(
            socket,
            acknowledge,
            "Only live meetings can be joined.",
          );
        }

        const userId = socket.data.user.id;

        if (!isHost(meeting, userId) && !isActiveParticipant(meeting, userId)) {
          return sendError(
            socket,
            acknowledge,
            "You are not an active participant in this meeting.",
          );
        }

        const roomName = getRoomName(meetingId);

        if (joinedRooms.has(roomName)) {
          return acknowledge?.({
            success: true,
            message: "Already joined this meeting room.",
            meetingId,
          });
        }

        await socket.join(roomName);
        joinedRooms.add(roomName);

        const presence = getMeetingPresence(meetingId);
        const user = socket.data.user;

        if (!presence.has(user.id)) {
          presence.set(user.id, {
            user: getSenderPayload(user),
            microphoneEnabled: false,
            cameraEnabled: false,
            connected: true,
          });
        } else {
          presence.get(user.id).connected = true;
        }

        // Send existing participants' current states to the new socket.
        socket.emit("meeting:presence:snapshot", {
          meetingId,
          participants: Array.from(presence.values()),
        });

        // Tell other participants that this user is present.
        socket.to(roomName).emit("meeting:presence:updated", {
          meetingId,
          ...presence.get(user.id),
        });

        socket.to(roomName).emit("meeting:participant-joined", {
          user: getSenderPayload(socket.data.user),
          meetingId,
        });

        return acknowledge?.({
          success: true,
          message: "Meeting room joined successfully.",
          meetingId,
        });
      } catch (error) {
        console.error("Meeting room join error:", error.message);

        return sendError(
          socket,
          acknowledge,
          "Unable to join the meeting room.",
        );
      }
    });

    /*
    ============================================================
    GET CONNECTED MEETING PARTICIPANTS
    ============================================================
    */

    socket.on(
      "meeting:participants:list",
      async (payload = {}, acknowledge) => {
        const respond =
          typeof acknowledge === "function" ? acknowledge : () => {};

        try {
          const { meetingId } = payload;

          // 1. Validate meeting ID
          if (!isValidMeetingId(meetingId)) {
            return respond({
              success: false,
              message: "A valid meeting ID is required.",
            });
          }

          // 2. Check that this socket joined the meeting
          const roomName = getRoomName(meetingId);

          if (!joinedRooms.has(roomName)) {
            return respond({
              success: false,
              message: "Join the meeting before requesting participants.",
            });
          }

          // 3. Verify meeting and user authorization
          const meeting = await Meeting.findById(meetingId)
            .select("host participants status")
            .lean();

          if (!meeting || meeting.status !== "live") {
            return respond({
              success: false,
              message: "Meeting is not available.",
            });
          }

          const userId = socket.data.user.id;

          if (!isMeetingMember(meeting, userId)) {
            return respond({
              success: false,
              message: "You are not authorized to view participants.",
            });
          }

          // 4. Read currently connected sockets in this room
          const roomSockets = await io.in(roomName).fetchSockets();

          // A user may have multiple tabs. Return each user only once.
          const uniqueParticipants = new Map();

          for (const roomSocket of roomSockets) {
            const user = roomSocket.data.user;

            if (!user?.id) continue;

            if (!uniqueParticipants.has(user.id)) {
              uniqueParticipants.set(user.id, {
                id: user.id,
                fullName: user.fullName,
                username: user.username,
                isHost: isHost(meeting, user.id),
              });
            }
          }

          const participants = Array.from(uniqueParticipants.values());

          return respond({
            success: true,
            message: "Connected participants loaded successfully.",
            data: {
              meetingId,
              total: participants.length,
              participants,
            },
          });
        } catch (error) {
          console.error("Meeting participants list error:", error.message);

          return respond({
            success: false,
            message: "Unable to load meeting participants.",
          });
        }
      },
    );

    /*
    ============================================================
    RAISE HAND / LOWER HAND
    ============================================================
    */

    socket.on("meeting:hand:update", async (payload = {}, acknowledge) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => {};

      try {
        const { meetingId, raised } = payload;

        if (!isValidMeetingId(meetingId) || typeof raised !== "boolean") {
          return respond({
            success: false,
            message: "Valid meeting ID and hand status are required.",
          });
        }

        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return respond({
            success: false,
            message: "Join the meeting first.",
          });
        }

        const meeting = await Meeting.findById(meetingId)
          .select("host participants status")
          .lean();

        if (!meeting || meeting.status !== "live") {
          return respond({
            success: false,
            message: "Meeting is not available.",
          });
        }

        const userId = socket.data.user.id;

        if (!isHost(meeting, userId) && !isActiveParticipant(meeting, userId)) {
          return respond({
            success: false,
            message: "You are not an active meeting participant.",
          });
        }

        const data = {
          meetingId,
          user: getSenderPayload(socket.data.user),
          raised,
          updatedAt: new Date().toISOString(),
        };

        io.to(roomName).emit("meeting:hand:updated", data);

        return respond({
          success: true,
          message: raised ? "Hand raised." : "Hand lowered.",
          data,
        });
      } catch (error) {
        console.error("Meeting hand update error:", error.message);

        return respond({
          success: false,
          message: "Unable to update hand status.",
        });
      }
    });

    /*
    ============================================================
    EMOJI REACTIONS
    ============================================================
    */

    socket.on("meeting:reaction:send", async (payload = {}, acknowledge) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => {};

      try {
        const { meetingId, emoji } = payload;

        const allowedReactions = ["👍", "👏", "❤️", "😂", "🎉", "😮", "👎"];

        if (
          !isValidMeetingId(meetingId) ||
          typeof emoji !== "string" ||
          !allowedReactions.includes(emoji)
        ) {
          return respond({
            success: false,
            message: "Invalid meeting ID or reaction.",
          });
        }

        if (isRateLimited(socket.data.user.id, "meeting:reaction:send")) {
          return respond({
            success: false,
            message: "Too many reactions. Please slow down.",
          });
        }

        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return respond({
            success: false,
            message: "Join the meeting before sending reactions.",
          });
        }

        const meeting = await Meeting.findById(meetingId)
          .select("host participants status")
          .lean();

        if (!meeting || meeting.status !== "live") {
          return respond({
            success: false,
            message: "Meeting is not available.",
          });
        }

        const userId = socket.data.user.id;

        if (!isHost(meeting, userId) && !isActiveParticipant(meeting, userId)) {
          return respond({
            success: false,
            message: "You are not an active meeting participant.",
          });
        }

        const reaction = {
          meetingId,
          emoji,
          user: getSenderPayload(socket.data.user),
          sentAt: new Date().toISOString(),
        };

        io.to(roomName).emit("meeting:reaction:received", reaction);

        return respond({
          success: true,
          message: "Reaction sent successfully.",
          data: reaction,
        });
      } catch (error) {
        console.error("Meeting reaction error:", error.message);

        return respond({
          success: false,
          message: "Unable to send reaction.",
        });
      }
    });

    /*
    ============================================================
    MICROPHONE / CAMERA STATUS SYNCHRONIZATION
    ============================================================
    */

    socket.on("meeting:media:status", async (payload = {}, acknowledge) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => {};

      try {
        const { meetingId, microphoneEnabled, cameraEnabled } = payload;

        // 1. Validate meeting ID
        if (!isValidMeetingId(meetingId)) {
          return respond({
            success: false,
            message: "A valid meeting ID is required.",
          });
        }

        // 2. Validate status values
        if (
          typeof microphoneEnabled !== "boolean" ||
          typeof cameraEnabled !== "boolean"
        ) {
          return respond({
            success: false,
            message: "Microphone and camera status must be boolean values.",
          });
        }

        // 3. Verify room membership
        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return respond({
            success: false,
            message: "Join the meeting before updating media status.",
          });
        }

        // 4. Verify meeting and participant authorization
        const meeting = await Meeting.findById(meetingId)
          .select("host participants status")
          .lean();

        if (!meeting || meeting.status !== "live") {
          return respond({
            success: false,
            message: "Meeting is not available.",
          });
        }

        const userId = socket.data.user.id;

        if (!isHost(meeting, userId) && !isActiveParticipant(meeting, userId)) {
          return respond({
            success: false,
            message: "You are not an active meeting participant.",
          });
        }

        const presence = getMeetingPresence(meetingId);

        const previousState = presence.get(userId) ?? {
          user: getSenderPayload(socket.data.user),
          connected: true,
        };

        const nextState = {
          ...previousState,
          user: getSenderPayload(socket.data.user),
          microphoneEnabled,
          cameraEnabled,
          connected: true,
        };

        presence.set(userId, nextState);

        // 5. Broadcast status to the other participants
        const mediaStatus = {
          meetingId,
          user: getSenderPayload(socket.data.user),
          microphoneEnabled,
          cameraEnabled,
          updatedAt: new Date().toISOString(),
        };

        socket.to(roomName).emit("meeting:media:status:updated", mediaStatus);

        io.to(roomName).emit("meeting:presence:updated", {
          meetingId,
          ...nextState,
        });

        return respond({
          success: true,
          message: "Media status updated successfully.",
          data: mediaStatus,
        });
      } catch (error) {
        console.error("Meeting media status error:", error.message);

        return respond({
          success: false,
          message: "Unable to update media status.",
        });
      }
    });

    /*
    ============================================================
    2. LEAVE MEETING ROOM
    ============================================================
    */

    socket.on("meeting:leave", async (payload = {}, acknowledge) => {
      try {
        const { meetingId } = payload;

        if (!isValidMeetingId(meetingId)) {
          return sendError(
            socket,
            acknowledge,
            "A valid meeting ID is required.",
          );
        }

        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return sendError(
            socket,
            acknowledge,
            "You have not joined this meeting room.",
          );
        }

        await socket.leave(roomName);
        joinedRooms.delete(roomName);

        const userId = socket.data.user.id;

        // Check whether this user has another connection in the room.
        const remainingSockets = await io.in(roomName).fetchSockets();

        const anotherConnectionExists = remainingSockets.some(
          (roomSocket) => roomSocket.data.user?.id === userId,
        );

        if (!anotherConnectionExists) {
          const presence = meetingPresence.get(meetingId);

          if (presence) {
            presence.delete(userId);

            if (presence.size === 0) {
              meetingPresence.delete(meetingId);
            }
          }

          socket.to(roomName).emit("meeting:presence:updated", {
            meetingId,
            user: getSenderPayload(socket.data.user),
            connected: false,
            microphoneEnabled: false,
            cameraEnabled: false,
            reason: "left",
          });

          // Notify others only when the user's final tab leaves.
          socket.to(roomName).emit("meeting:participant-left", {
            user: getSenderPayload(socket.data.user),
            meetingId,
            reason: "left",
          });
        }

        socket.to(roomName).emit("meeting:participant-left", {
          user: getSenderPayload(socket.data.user),
          meetingId,
          reason: "left",
        });

        return acknowledge?.({
          success: true,
          message: "Meeting room left successfully.",
          meetingId,
        });
      } catch (error) {
        console.error("Meeting room leave error:", error.message);

        return sendError(
          socket,
          acknowledge,
          "Unable to leave the meeting room.",
        );
      }
    });

    /*
    ============================================================
    3. SEND CHAT MESSAGE — SAVE TO MONGODB
    ============================================================
    */

    socket.on("meeting:chat:send", async (payload = {}, acknowledge) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => {};

      try {
        const { meetingId, message } = payload;

        if (!isValidMeetingId(meetingId)) {
          return respond({
            success: false,
            message: "Invalid meeting ID.",
          });
        }

        if (isRateLimited(socket.data.user.id, "meeting:chat:send")) {
          return respond({
            success: false,
            message: "Too many messages. Please slow down.",
          });
        }

        if (typeof message !== "string") {
          return respond({
            success: false,
            message: "Message must be text.",
          });
        }

        const trimmedMessage = message.trim();

        if (!trimmedMessage || trimmedMessage.length > 2000) {
          return respond({
            success: false,
            message: "Message must contain 1–2000 characters.",
          });
        }

        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return respond({
            success: false,
            message: "Join the meeting before sending messages.",
          });
        }

        const meeting = await Meeting.findById(meetingId)
          .select("host participants status settings")
          .lean();

        if (!meeting || meeting.status !== "live") {
          return respond({
            success: false,
            message: "Meeting is not available.",
          });
        }

        if (meeting.settings?.allowChat === false) {
          return respond({
            success: false,
            message: "Chat is disabled for this meeting.",
          });
        }

        const senderId = socket.data.user.id;

        if (
          !isHost(meeting, senderId) &&
          !isActiveParticipant(meeting, senderId)
        ) {
          return respond({
            success: false,
            message: "You are not an active meeting participant.",
          });
        }

        // Save first; do not broadcast a message that failed to save.
        const savedMessage = await ChatMessage.create({
          meeting: meeting._id,
          sender: senderId,
          message: trimmedMessage,
        });

        const chatMessage = {
          _id: savedMessage._id.toString(),
          meetingId: meeting._id.toString(),
          sender: getSenderPayload(socket.data.user),
          message: savedMessage.message,
          sentAt: savedMessage.createdAt.toISOString(),
        };

        io.to(roomName).emit("meeting:chat:message", chatMessage);

        return respond({
          success: true,
          message: "Message sent successfully.",
          data: chatMessage,
        });
      } catch (error) {
        console.error("Meeting chat send error:", error.message);

        return respond({
          success: false,
          message: "Unable to send message.",
        });
      }
    });

    /*
    ============================================================
    4. FETCH CHAT HISTORY — PAGINATION
    ============================================================

    Request:
    socket.emit("meeting:chat:history", {
      meetingId: "...",
      limit: 50,
      before: "optional-previous-message-id"
    }, callback);

    The result is returned oldest-to-newest within this page.
    Use the first message's _id as `before` to fetch an older page.
    */

    socket.on("meeting:chat:history", async (payload = {}, acknowledge) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => {};

      try {
        const { meetingId, before } = payload;

        if (!isValidMeetingId(meetingId)) {
          return respond({
            success: false,
            message: "Invalid meeting ID.",
          });
        }

        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return respond({
            success: false,
            message: "Join the meeting before loading chat history.",
          });
        }

        const meeting = await Meeting.findById(meetingId)
          .select("host participants status settings")
          .lean();

        if (!meeting) {
          return respond({
            success: false,
            message: "Meeting not found.",
          });
        }

        const userId = socket.data.user.id;

        if (!isMeetingMember(meeting, userId)) {
          return respond({
            success: false,
            message: "You are not authorized to view this chat.",
          });
        }

        if (meeting.settings?.allowChat === false) {
          return respond({
            success: false,
            message: "Chat is disabled for this meeting.",
          });
        }

        // Keep page size within 1–100 messages.
        const requestedLimit = Number(payload.limit);
        const limit = Number.isFinite(requestedLimit)
          ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
          : 50;

        const query = {
          meeting: meeting._id,
        };

        if (before !== undefined && before !== null) {
          if (typeof before !== "string" || !mongoose.isValidObjectId(before)) {
            return respond({
              success: false,
              message: "Invalid chat pagination cursor.",
            });
          }

          const cursorMessage = await ChatMessage.findOne({
            _id: before,
            meeting: meeting._id,
          })
            .select("_id createdAt")
            .lean();

          if (!cursorMessage) {
            return respond({
              success: false,
              message: "Chat pagination cursor was not found.",
            });
          }

          query.$or = [
            { createdAt: { $lt: cursorMessage.createdAt } },
            {
              createdAt: cursorMessage.createdAt,
              _id: { $lt: cursorMessage._id },
            },
          ];
        }

        // Query newest-first for efficient pagination.
        const documents = await ChatMessage.find(query)
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit + 1)
          .populate("sender", "fullName username")
          .lean();

        const hasMore = documents.length > limit;
        const page = documents.slice(0, limit);

        // Return messages in chronological order to the frontend.
        page.reverse();

        const messages = page.map((item) => ({
          _id: item._id.toString(),
          meetingId: meeting._id.toString(),
          sender: item.sender
            ? {
                id: item.sender._id.toString(),
                fullName: item.sender.fullName,
                username: item.sender.username,
              }
            : {
                id: item.sender?.toString() ?? "",
                fullName: "Unknown user",
                username: "",
              },
          message: item.message,
          sentAt: item.createdAt.toISOString(),
        }));

        return respond({
          success: true,
          message: "Chat history loaded successfully.",
          data: {
            messages,
            hasMore,
            nextBefore: hasMore && messages.length > 0 ? messages[0]._id : null,
          },
        });
      } catch (error) {
        console.error("Meeting chat history error:", error.message);

        return respond({
          success: false,
          message: "Unable to load chat history.",
        });
      }
    });

    /*
    ============================================================
    CHAT MESSAGE DELETE — SENDER OR MEETING HOST
    ============================================================
    */

    socket.on("meeting:chat:delete", async (payload = {}, acknowledge) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => {};

      try {
        const { meetingId, messageId } = payload;

        // 1. Validate IDs
        if (
          !isValidMeetingId(meetingId) ||
          typeof messageId !== "string" ||
          !mongoose.isValidObjectId(messageId)
        ) {
          return respond({
            success: false,
            message: "Valid meeting and message IDs are required.",
          });
        }

        // 2. Ensure the user has joined this meeting room
        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return respond({
            success: false,
            message: "Join the meeting before deleting messages.",
          });
        }

        // 3. Load meeting
        const meeting = await Meeting.findById(meetingId)
          .select("host participants status")
          .lean();

        if (!meeting || meeting.status !== "live") {
          return respond({
            success: false,
            message: "Meeting is not available.",
          });
        }

        const userId = socket.data.user.id;
        const userIsHost = isHost(meeting, userId);

        const userIsActiveParticipant = isActiveParticipant(meeting, userId);

        if (!userIsHost && !userIsActiveParticipant) {
          return respond({
            success: false,
            message: "You are not an active meeting participant.",
          });
        }

        // 4. Find the message inside this meeting only
        const chatMessage = await ChatMessage.findOne({
          _id: messageId,
          meeting: meeting._id,
        });

        if (!chatMessage) {
          return respond({
            success: false,
            message: "Chat message not found.",
          });
        }

        // 5. Only the original sender or meeting host can delete it
        const senderId = chatMessage.sender.toString();

        if (senderId !== userId && !userIsHost) {
          return respond({
            success: false,
            message: "You can only delete your own messages.",
          });
        }

        // 6. Delete from MongoDB
        await ChatMessage.deleteOne({
          _id: chatMessage._id,
          meeting: meeting._id,
        });

        // 7. Notify everyone in the meeting
        io.to(roomName).emit("meeting:chat:deleted", {
          meetingId,
          messageId: chatMessage._id.toString(),
          deletedBy: userId,
        });

        return respond({
          success: true,
          message: "Chat message deleted successfully.",
          data: {
            meetingId,
            messageId: chatMessage._id.toString(),
          },
        });
      } catch (error) {
        console.error("Meeting chat delete error:", error.message);

        return respond({
          success: false,
          message: "Unable to delete chat message.",
        });
      }
    });

    /*
    ============================================================
    CHAT MESSAGE EDIT — ORIGINAL SENDER ONLY
    ============================================================
    */

    socket.on("meeting:chat:edit", async (payload = {}, acknowledge) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => {};

      try {
        const { meetingId, messageId, message } = payload;

        // 1. Validate meeting and message IDs
        if (
          !isValidMeetingId(meetingId) ||
          typeof messageId !== "string" ||
          !mongoose.isValidObjectId(messageId)
        ) {
          return respond({
            success: false,
            message: "Valid meeting and message IDs are required.",
          });
        }

        // 2. Validate updated message
        if (typeof message !== "string") {
          return respond({
            success: false,
            message: "Message must be text.",
          });
        }

        const trimmedMessage = message.trim();

        if (!trimmedMessage || trimmedMessage.length > 2000) {
          return respond({
            success: false,
            message: "Message must contain 1–2000 characters.",
          });
        }

        // 3. User must have joined this meeting room
        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return respond({
            success: false,
            message: "Join the meeting before editing messages.",
          });
        }

        // 4. Load meeting and check permissions
        const meeting = await Meeting.findById(meetingId)
          .select("host participants status settings")
          .lean();

        if (!meeting || meeting.status !== "live") {
          return respond({
            success: false,
            message: "Meeting is not available.",
          });
        }

        if (meeting.settings?.allowChat === false) {
          return respond({
            success: false,
            message: "Chat is disabled for this meeting.",
          });
        }

        const userId = socket.data.user.id;

        if (!isHost(meeting, userId) && !isActiveParticipant(meeting, userId)) {
          return respond({
            success: false,
            message: "You are not an active meeting participant.",
          });
        }

        // 5. Find message belonging to this meeting
        const chatMessage = await ChatMessage.findOne({
          _id: messageId,
          meeting: meeting._id,
        });

        if (!chatMessage) {
          return respond({
            success: false,
            message: "Chat message not found.",
          });
        }

        // 6. Only the original sender may edit their message
        if (chatMessage.sender.toString() !== userId) {
          return respond({
            success: false,
            message: "You can only edit your own messages.",
          });
        }

        // 7. Update the database document
        chatMessage.message = trimmedMessage;
        await chatMessage.save();

        const updatedMessage = {
          _id: chatMessage._id.toString(),
          meetingId: meeting._id.toString(),
          sender: getSenderPayload(socket.data.user),
          message: chatMessage.message,
          sentAt: chatMessage.createdAt.toISOString(),
          updatedAt: chatMessage.updatedAt.toISOString(),
          edited: true,
        };

        // 8. Notify all participants in real time
        io.to(roomName).emit("meeting:chat:updated", updatedMessage);

        return respond({
          success: true,
          message: "Chat message updated successfully.",
          data: updatedMessage,
        });
      } catch (error) {
        console.error("Meeting chat edit error:", error.message);

        return respond({
          success: false,
          message: "Unable to edit chat message.",
        });
      }
    });

    /*
    ============================================================
    5. WEBRTC SIGNALING — OFFER
    ============================================================
    */

    socket.on("webrtc:offer", async (payload = {}, acknowledge) => {
      try {
        const { meetingId, targetSocketId, offer } = payload;

        if (
          !isValidMeetingId(meetingId) ||
          typeof targetSocketId !== "string" ||
          !targetSocketId ||
          !offer
        ) {
          return sendError(
            socket,
            acknowledge,
            "Valid meeting ID, target socket, and offer are required.",
          );
        }

        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return sendError(
            socket,
            acknowledge,
            "Join the meeting before sending an offer.",
          );
        }

        // Verify that the meeting is still live.
        const meeting = await Meeting.findById(meetingId)
          .select("host participants status")
          .lean();

        if (!meeting || meeting.status !== "live") {
          return sendError(socket, acknowledge, "Meeting is not available.");
        }

        // Verify the sender's current meeting access.
        const userId = socket.data.user.id;

        if (!isHost(meeting, userId) && !isActiveParticipant(meeting, userId)) {
          return sendError(
            socket,
            acknowledge,
            "You are not an active meeting participant.",
          );
        }

        // Target must be connected to this same meeting room.
        const targetSocket = io.sockets.sockets.get(targetSocketId);

        if (!targetSocket || !targetSocket.rooms.has(roomName)) {
          return sendError(
            socket,
            acknowledge,
            "Target participant is not in this meeting.",
          );
        }

        targetSocket.emit("webrtc:offer", {
          meetingId,
          fromSocketId: socket.id,
          fromUser: getSenderPayload(socket.data.user),
          offer,
        });

        return acknowledge?.({
          success: true,
          message: "WebRTC offer delivered.",
        });
      } catch (error) {
        console.error("WebRTC offer error:", error.message);

        return sendError(socket, acknowledge, "Unable to send WebRTC offer.");
      }
    });

    /*
    ============================================================
    6. WEBRTC SIGNALING — ANSWER
    ============================================================
    */

    socket.on("webrtc:answer", async (payload = {}, acknowledge) => {
      try {
        const { meetingId, targetSocketId, answer } = payload;

        if (
          !isValidMeetingId(meetingId) ||
          typeof targetSocketId !== "string" ||
          !targetSocketId ||
          !answer
        ) {
          return sendError(
            socket,
            acknowledge,
            "Valid meeting ID, target socket, and answer are required.",
          );
        }

        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return sendError(
            socket,
            acknowledge,
            "Join the meeting before sending an answer.",
          );
        }

        // Check that the meeting is still live.
        const meeting = await Meeting.findById(meetingId)
          .select("host participants status")
          .lean();

        if (!meeting || meeting.status !== "live") {
          return sendError(socket, acknowledge, "Meeting is not available.");
        }

        // Check the sender's current membership.
        const userId = socket.data.user.id;

        if (!isHost(meeting, userId) && !isActiveParticipant(meeting, userId)) {
          return sendError(
            socket,
            acknowledge,
            "You are not an active meeting participant.",
          );
        }

        const targetSocket = io.sockets.sockets.get(targetSocketId);

        if (!targetSocket || !targetSocket.rooms.has(roomName)) {
          return sendError(
            socket,
            acknowledge,
            "Target participant is not in this meeting.",
          );
        }

        targetSocket.emit("webrtc:answer", {
          meetingId,
          fromSocketId: socket.id,
          fromUser: getSenderPayload(socket.data.user),
          answer,
        });

        return acknowledge?.({
          success: true,
          message: "WebRTC answer delivered.",
        });
      } catch (error) {
        console.error("WebRTC answer error:", error.message);

        return sendError(socket, acknowledge, "Unable to send WebRTC answer.");
      }
    });

    /*
    ============================================================
    7. WEBRTC SIGNALING — ICE CANDIDATE
    ============================================================
    */

    socket.on("webrtc:ice-candidate", async (payload = {}, acknowledge) => {
      try {
        const { meetingId, targetSocketId, candidate } = payload;

        if (
          !isValidMeetingId(meetingId) ||
          typeof targetSocketId !== "string" ||
          !targetSocketId ||
          !candidate
        ) {
          return sendError(
            socket,
            acknowledge,
            "Valid meeting ID, target socket, and ICE candidate are required.",
          );
        }

        const roomName = getRoomName(meetingId);

        if (!joinedRooms.has(roomName)) {
          return sendError(
            socket,
            acknowledge,
            "Join the meeting before sending an ICE candidate.",
          );
        }

        // Verify that the meeting is still live.
        const meeting = await Meeting.findById(meetingId)
          .select("host participants status")
          .lean();

        if (!meeting || meeting.status !== "live") {
          return sendError(socket, acknowledge, "Meeting is not available.");
        }

        // Verify the sender's current meeting access.
        const userId = socket.data.user.id;

        if (!isHost(meeting, userId) && !isActiveParticipant(meeting, userId)) {
          return sendError(
            socket,
            acknowledge,
            "You are not an active meeting participant.",
          );
        }

        // Target must be connected to the same meeting room.
        const targetSocket = io.sockets.sockets.get(targetSocketId);

        if (!targetSocket || !targetSocket.rooms.has(roomName)) {
          return sendError(
            socket,
            acknowledge,
            "Target participant is not in this meeting.",
          );
        }

        targetSocket.emit("webrtc:ice-candidate", {
          meetingId,
          fromSocketId: socket.id,
          candidate,
        });

        return acknowledge?.({
          success: true,
          message: "ICE candidate delivered.",
        });
      } catch (error) {
        console.error("ICE candidate error:", error.message);

        return sendError(socket, acknowledge, "Unable to send ICE candidate.");
      }
    });

    /*
    ============================================================
    8. DISCONNECT — HANDLE MULTIPLE TABS
    ============================================================
    */

    socket.on("disconnecting", async () => {
      const userId = socket.data.user?.id;

      if (!userId) return;

      for (const roomName of socket.rooms) {
        if (!roomName.startsWith("meeting:")) continue;
        if (!joinedRooms.has(roomName)) continue;

        const meetingId = roomName.slice("meeting:".length);

        try {
          const roomSockets = await io.in(roomName).fetchSockets();

          const anotherConnectionExists = roomSockets.some(
            (roomSocket) =>
              roomSocket.id !== socket.id &&
              roomSocket.data.user?.id === userId,
          );

          // Notify only when the user's final socket leaves this room.

          if (!anotherConnectionExists) {
            const presence = meetingPresence.get(meetingId);

            if (presence) {
              presence.delete(userId);

              if (presence.size === 0) {
                meetingPresence.delete(meetingId);
              }
            }

            socket.to(roomName).emit("meeting:participant-left", {
              meetingId,
              userId,
              reason: "disconnected",
            });

            socket.to(roomName).emit("meeting:presence:updated", {
              meetingId,
              user: {
                id: userId,
                fullName: socket.data.user.fullName,
                username: socket.data.user.username,
              },
              connected: false,
              microphoneEnabled: false,
              cameraEnabled: false,
              reason: "disconnected",
            });
          }
        } catch (error) {
          console.error(
            "Participant disconnect handling error:",
            error.message,
          );
        }
      }
    });
  });
}

