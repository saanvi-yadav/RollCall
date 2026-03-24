const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
  getAllStudents,
  getAllProfessors,
  createUser,
  updateUser,
  deleteUser,
  getDashboardStats,
} = require("../controllers/adminController");

// Protected routes (require authentication)
router.get("/students", authMiddleware, getAllStudents);
router.get("/professors", authMiddleware, getAllProfessors);
router.get("/stats", authMiddleware, getDashboardStats);
router.post("/users", authMiddleware, createUser);
router.put("/users/:id", authMiddleware, updateUser);
router.delete("/users/:id", authMiddleware, deleteUser);

module.exports = router;
