import mongoose from "mongoose";
import crypto from "node:crypto";

const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["host", "participant"],
      default: "participant",
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Meeting title is required."],
      trim: true,
      minlength: [3, "Meeting title must be at least 3 characters."],
      maxlength: [100, "Meeting title cannot exceed 100 characters."],
    },

    meetingCode: {
      type: String,
      unique: true,
      index: true,
      immutable: true,
    },

    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    participants: {
      type: [participantSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["scheduled", "live", "ended", "cancelled"],
      default: "scheduled",
      index: true,
    },

    scheduledAt: {
      type: Date,
      default: null,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    maxParticipants: {
      type: Number,
      default: 10,
      min: 2,
      max: 10,
    },

    settings: {
      allowChat: {
        type: Boolean,
        default: true,
      },
      allowScreenShare: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Generate a random, hard-to-guess meeting code.
meetingSchema.pre("validate", function () {
  if (!this.meetingCode) {
    this.meetingCode = crypto.randomBytes(6).toString("hex");
  }
});

meetingSchema.pre("validate", function () {
  const participants = this.participants ?? [];
  const seenUsers = new Set();
  let activeCount = 0;

  for (const participant of participants) {
    const userId = participant.user?.toString();

    if (!userId) {
      continue;
    }

    // A user should have only one participant record.
    if (seenUsers.has(userId)) {
      this.invalidate(
        "participants",
        "A user cannot have duplicate participant records.",
      );
      break;
    }

    seenUsers.add(userId);

    if (!participant.leftAt) {
      activeCount += 1;
    }
  }

  // The host counts toward the participant limit.
  if (
    Number.isInteger(this.maxParticipants) &&
    activeCount > this.maxParticipants
  ) {
    this.invalidate(
      "participants",
      "Active participants cannot exceed maxParticipants.",
    );
  }
});

meetingSchema.index({ host: 1, createdAt: -1 });
meetingSchema.index({ scheduledAt: 1, status: 1 });

const Meeting = mongoose.model("Meeting", meetingSchema);

export default Meeting;
