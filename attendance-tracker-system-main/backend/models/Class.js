const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
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
  },
  { timestamps: true },
);

module.exports = mongoose.model("Class", classSchema);
