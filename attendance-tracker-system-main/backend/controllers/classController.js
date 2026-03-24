const Class = require("../models/Class");
const User = require("../models/User");
const Attendance = require("../models/Attendance");

// Get all classes
const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("professor", "name email")
      .populate("students", "name email");
    res.json(classes);
  } catch (err) {
    console.error("GetAllClasses error:", err);
    res.status(500).json({ message: err.message || "Failed to get classes" });
  }
};

// Get professor's classes
const getProfessorClasses = async (req, res) => {
  try {
    const classes = await Class.find({ professor: req.user._id }).populate(
      "students",
      "name email",
    );
    res.json(classes);
  } catch (err) {
    console.error("GetProfessorClasses error:", err);
    res.status(500).json({ message: err.message || "Failed to get classes" });
  }
};

// Get student's classes
const getStudentClasses = async (req, res) => {
  try {
    const classes = await Class.find({ students: req.user._id }).populate(
      "professor",
      "name email",
    );
    res.json(classes);
  } catch (err) {
    console.error("GetStudentClasses error:", err);
    res.status(500).json({ message: err.message || "Failed to get classes" });
  }
};

// Create class
const createClass = async (req, res) => {
  try {
    const { subject, course, semester, section } = req.body;

    if (!subject || !course || !semester || !section) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newClass = await Class.create({
      subject,
      course,
      semester,
      section,
      professor: req.user._id,
      students: [],
    });

    res.status(201).json(newClass);
  } catch (err) {
    console.error("CreateClass error:", err);
    res.status(500).json({ message: err.message || "Failed to create class" });
  }
};

// Add student to class
const addStudentToClass = async (req, res) => {
  try {
    const { classId, studentId } = req.body;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    if (classData.students.includes(studentId)) {
      return res.status(400).json({ message: "Student already in this class" });
    }

    classData.students.push(studentId);
    await classData.save();

    await classData.populate("students", "name email");
    res.json(classData);
  } catch (err) {
    console.error("AddStudentToClass error:", err);
    res.status(500).json({ message: err.message || "Failed to add student" });
  }
};

// Get class students
const getClassStudents = async (req, res) => {
  try {
    const { classId } = req.params;
    const classData = await Class.findById(classId).populate(
      "students",
      "name email _id",
    );

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json(classData.students);
  } catch (err) {
    console.error("GetClassStudents error:", err);
    res.status(500).json({ message: err.message || "Failed to get students" });
  }
};

// Mark attendance for class
const markClassAttendance = async (req, res) => {
  try {
    const { classId, attendanceData } = req.body;

    if (!classId || !attendanceData) {
      return res
        .status(400)
        .json({ message: "Class ID and attendance data are required" });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const results = [];

    for (const [studentId, status] of Object.entries(attendanceData)) {
      const attendance = await Attendance.create({
        user: studentId,
        status,
        date: new Date(),
      });
      results.push(attendance);
    }

    res
      .status(201)
      .json({ message: "Attendance marked successfully", results });
  } catch (err) {
    console.error("MarkClassAttendance error:", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to mark attendance" });
  }
};

module.exports = {
  getAllClasses,
  getProfessorClasses,
  getStudentClasses,
  createClass,
  addStudentToClass,
  getClassStudents,
  markClassAttendance,
};
