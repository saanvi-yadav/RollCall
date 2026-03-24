const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    targetRoles: [
      {
        type: String,
        enum: ["student", "professor", "admin"],
        required: true,
      },
    ],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetCourse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    targetClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },
    targetSemester: {
      type: String,
      default: "",
      trim: true,
    },
    targetSection: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notification", notificationSchema);
