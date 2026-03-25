const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const userRoutes = require("./routes/userRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const courseRoutes = require("./routes/courseRoutes");
const classRoutes = require("./routes/classRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const academicConfigRoutes = require("./routes/academicConfigRoutes");

const app = express();
const DEFAULT_ADMIN = {
  name: "System Admin",
  email: "admin@gmail.com",
  password: "admin123",
  role: "admin",
  username: "admin",
};

const ensureDefaultAdmin = async () => {
  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

  await User.findOneAndUpdate(
    { email: DEFAULT_ADMIN.email },
    {
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      password: hashedPassword,
      role: DEFAULT_ADMIN.role,
      username: DEFAULT_ADMIN.username,
      department: "",
      semester: "",
      section: "",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/attendanceDB";
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected successfully");
    await ensureDefaultAdmin();
    console.log("Default admin account is ready");
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/academic-config", academicConfigRoutes);

// Test route
app.get("/test", (req, res) => {
  res.send("Backend + Database connected 🚀");
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
