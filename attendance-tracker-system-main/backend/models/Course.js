const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    semester: {
      type: Number,
      required: true,
    },
    professor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    description: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Course", courseSchema);
