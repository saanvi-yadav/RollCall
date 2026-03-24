const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getNotifications,
  createNotification,
} = require("../controllers/notificationController");

router.get("/", authMiddleware, getNotifications);
router.post("/", authMiddleware, createNotification);

module.exports = router;
