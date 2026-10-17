import mongoose from "mongoose";

const meetingScheduleSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      unique: true,
    },

    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
      validate: {
        validator(value) {
          return value instanceof Date && !Number.isNaN(value.getTime());
        },
        message: "A valid scheduled date and time is required.",
      },
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 480,
      default: 30,
    },

    status: {
      type: String,
      enum: ["scheduled", "cancelled", "completed"],
      default: "scheduled",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

meetingScheduleSchema.index({ host: 1, scheduledAt: 1 });

const MeetingSchedule = mongoose.model(
  "MeetingSchedule",
  meetingScheduleSchema,
);

export default MeetingSchedule;

