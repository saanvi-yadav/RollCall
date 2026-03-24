const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
console.log("Attendance routes loaded");
const {
  markAttendance,
  getMyAttendance,
  getAttendanceStats,
  getAttendanceByDate,
  getAllAttendanceRecords,
  getStudentAttendance,
  getClassAttendanceReport,
  getClassAttendanceSession,
} = require("../controllers/attendanceController");

router.post("/mark", authMiddleware, markAttendance);
router.get("/my", authMiddleware, getMyAttendance);
router.get("/stats", authMiddleware, getAttendanceStats);
router.get("/by-date", authMiddleware, getAttendanceByDate);
router.get("/all", authMiddleware, getAllAttendanceRecords);
router.get("/student/:studentId", authMiddleware, getStudentAttendance);
router.get("/class/:classId/report", authMiddleware, getClassAttendanceReport);
router.get("/class/:classId/session", authMiddleware, getClassAttendanceSession);

module.exports = router;
