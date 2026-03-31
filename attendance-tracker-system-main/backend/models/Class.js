const mongoose = require("mongoose");

const weekdayValues = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const classSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
    },
    courseRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    course: {
      type: String,
      required: true,
    },
    semester: {
      type: String,
      required: true,
    },
    section: {
      type: String,
      required: true,
    },
    professor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    scheduleDate: {
      type: Date,
      default: null,
    },
    termStartDate: {
      type: Date,
      required: true,
    },
    termEndDate: {
      type: Date,
      required: true,
    },
    weekdays: [
      {
        type: String,
        enum: weekdayValues,
      },
    ],
    exceptions: [
      {
        type: Date,
      },
    ],
    scheduleType: {
      type: String,
      enum: ["weekly"],
      default: "weekly",
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    room: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Class", classSchema);
