const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllCourses,
  getProfessorCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} = require("../controllers/courseController");

// Public routes
router.get("/", getAllCourses);

// Protected routes
router.get("/professor", authMiddleware, getProfessorCourses);
router.post("/", authMiddleware, createCourse);
router.put("/:id", authMiddleware, updateCourse);
router.delete("/:id", authMiddleware, deleteCourse);

module.exports = router;
