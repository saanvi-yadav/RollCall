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
    academicEvents: [
      {
        title: {
          type: String,
          trim: true,
          required: true,
        },
        type: {
          type: String,
          enum: ["holiday", "exam", "no_class"],
          required: true,
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          required: true,
        },
        notes: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("AcademicConfig", academicConfigSchema);
