const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
  registerUser,
  loginUser,
  changePassword,
  updateProfile,
} = require("../controllers/usersController");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/change-password", authMiddleware, changePassword);
router.put("/profile", authMiddleware, updateProfile);

module.exports = router;
