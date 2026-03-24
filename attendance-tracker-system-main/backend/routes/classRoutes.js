const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllClasses,
  getProfessorClasses,
  getStudentClasses,
  createClass,
  addStudentToClass,
  getClassStudents,
  markClassAttendance,
} = require("../controllers/classController");

// Public routes
router.get("/", getAllClasses);

// Protected routes
router.get("/professor", authMiddleware, getProfessorClasses);
router.get("/student", authMiddleware, getStudentClasses);
router.get("/:classId/students", authMiddleware, getClassStudents);
router.post("/", authMiddleware, createClass);
router.post("/add-student", authMiddleware, addStudentToClass);
router.post("/mark-attendance", authMiddleware, markClassAttendance);

module.exports = router;
