const mongoose = require("mongoose");

const academicConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
    },
    departments: [
      {
        type: String,
        trim: true,
      },
    ],
    semesters: [
      {
        type: String,
        trim: true,
      },
    ],
    sections: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("AcademicConfig", academicConfigSchema);
