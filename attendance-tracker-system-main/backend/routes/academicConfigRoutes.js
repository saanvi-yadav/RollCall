const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
  getAcademicConfig,
  updateAcademicConfig,
} = require("../controllers/academicConfigController");

router.get("/", authMiddleware, getAcademicConfig);
router.put("/", authMiddleware, updateAcademicConfig);

module.exports = router;
