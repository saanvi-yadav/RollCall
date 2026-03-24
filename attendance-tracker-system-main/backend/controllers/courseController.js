const Course = require("../models/Course");
const User = require("../models/User");

// Get all courses
const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find().populate("professor", "name email");
    res.json(courses);
  } catch (err) {
    console.error("GetAllCourses error:", err);
    res.status(500).json({ message: err.message || "Failed to get courses" });
  }
};

// Get courses by professor
const getProfessorCourses = async (req, res) => {
  try {
    const courses = await Course.find({ professor: req.user._id });
    res.json(courses);
  } catch (err) {
    console.error("GetProfessorCourses error:", err);
    res.status(500).json({ message: err.message || "Failed to get courses" });
  }
};

// Create course
const createCourse = async (req, res) => {
  try {
    const { name, code, semester, description } = req.body;

    if (!name || !code || !semester) {
      return res
        .status(400)
        .json({ message: "Name, code, and semester are required" });
    }

    const courseExists = await Course.findOne({ code });
    if (courseExists) {
      return res
        .status(400)
        .json({ message: "Course with this code already exists" });
    }

    const course = await Course.create({
      name,
      code,
      semester,
      description,
      professor: req.user._id,
    });

    res.status(201).json(course);
  } catch (err) {
    console.error("CreateCourse error:", err);
    res.status(500).json({ message: err.message || "Failed to create course" });
  }
};

// Update course
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, semester, description, professor } = req.body;

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if code is unique (if changed)
    if (code && code !== course.code) {
      const codeExists = await Course.findOne({ code });
      if (codeExists) {
        return res
          .status(400)
          .json({ message: "Course with this code already exists" });
      }
    }

    if (name) course.name = name;
    if (code) course.code = code;
    if (semester) course.semester = semester;
    if (description) course.description = description;
    if (professor) course.professor = professor;

    await course.save();
    res.json(course);
  } catch (err) {
    console.error("UpdateCourse error:", err);
    res.status(500).json({ message: err.message || "Failed to update course" });
  }
};

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByIdAndDelete(id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error("DeleteCourse error:", err);
    res.status(500).json({ message: err.message || "Failed to delete course" });
  }
};

module.exports = {
  getAllCourses,
  getProfessorCourses,
  createCourse,
  updateCourse,
  deleteCourse,
};
