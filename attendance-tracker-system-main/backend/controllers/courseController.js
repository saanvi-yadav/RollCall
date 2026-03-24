const Course = require("../models/Course");
const User = require("../models/User");

// Get all courses
const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate("professor", "name email")
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (err) {
    console.error("GetAllCourses error:", err);
    res.status(500).json({ message: err.message || "Failed to get courses" });
  }
};

// Get courses by professor
const getProfessorCourses = async (req, res) => {
  try {
    const courses = await Course.find({ professor: req.user._id }).sort({
      semester: 1,
      name: 1,
    });
    res.json(courses);
  } catch (err) {
    console.error("GetProfessorCourses error:", err);
    res.status(500).json({ message: err.message || "Failed to get courses" });
  }
};

// Create course
const createCourse = async (req, res) => {
  try {
    const { name, code, semester, description, professor, department } = req.body;

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

    let assignedProfessor = professor || req.user._id;
    if (assignedProfessor) {
      const professorExists = await User.findOne({
        _id: assignedProfessor,
        role: "professor",
      });

      if (!professorExists) {
        return res.status(400).json({ message: "Assigned professor not found" });
      }
    }

    const course = await Course.create({
      name,
      code,
      semester,
      description,
      department,
      professor: assignedProfessor,
    });

    await course.populate("professor", "name email");
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
    const { name, code, semester, description, professor, department } = req.body;

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

    if (professor) {
      const professorExists = await User.findOne({
        _id: professor,
        role: "professor",
      });

      if (!professorExists) {
        return res.status(400).json({ message: "Assigned professor not found" });
      }
    }

    if (name) course.name = name;
    if (code) course.code = code;
    if (semester) course.semester = semester;
    if (description !== undefined) course.description = description;
    if (department !== undefined) course.department = department;
    if (professor !== undefined) course.professor = professor || null;

    await course.save();
    await course.populate("professor", "name email");
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
