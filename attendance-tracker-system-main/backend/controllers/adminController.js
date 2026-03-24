const User = require("../models/User");
const Course = require("../models/Course");
const Class = require("../models/Class");
const Attendance = require("../models/Attendance");
const bcrypt = require("bcryptjs");

const normalizeOptional = (value) => (value ? String(value).trim() : "");

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: "student" }).select("-password");
    res.json(students);
  } catch (err) {
    console.error("GetAllStudents error:", err);
    res.status(500).json({ message: err.message || "Failed to get students" });
  }
};

// Get all professors
const getAllProfessors = async (req, res) => {
  try {
    const professors = await User.find({ role: "professor" }).select(
      "-password",
    );
    res.json(professors);
  } catch (err) {
    console.error("GetAllProfessors error:", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to get professors" });
  }
};

// Create user (student/professor)
const createUser = async (req, res) => {
  try {
    const { name, email, role, password, department, semester, section } = req.body;

    if (!name || !email || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, and role are required" });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const generatedPassword = password?.trim() || "Password@123";
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      department: normalizeOptional(department),
      semester: role === "student" ? normalizeOptional(semester) : "",
      section: role === "student" ? normalizeOptional(section).toUpperCase() : "",
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      semester: user.semester,
      section: user.section,
      message: password
        ? "User created successfully"
        : `User created with default password: ${generatedPassword}`,
    });
  } catch (err) {
    console.error("CreateUser error:", err);
    res.status(500).json({ message: err.message || "Failed to create user" });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password, department, semester, section } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (email) {
      const emailExists = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id },
      });
      if (emailExists) {
        return res.status(400).json({ message: "Email already in use" });
      }
      user.email = email.toLowerCase();
    }
    if (role) user.role = role;
    if (password && password.trim()) {
      user.password = await bcrypt.hash(password.trim(), 10);
    }
    if (department !== undefined) user.department = normalizeOptional(department);

    const effectiveRole = role || user.role;
    if (effectiveRole === "student") {
      if (semester !== undefined) user.semester = normalizeOptional(semester);
      if (section !== undefined) user.section = normalizeOptional(section).toUpperCase();
    } else {
      user.semester = "";
      user.section = "";
    }

    await user.save();
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      semester: user.semester,
      section: user.section,
    });
  } catch (err) {
    console.error("UpdateUser error:", err);
    res.status(500).json({ message: err.message || "Failed to update user" });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("DeleteUser error:", err);
    res.status(500).json({ message: err.message || "Failed to delete user" });
  }
};

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalProfessors = await User.countDocuments({ role: "professor" });
    const totalCourses = await Course.countDocuments();
    const totalClasses = await Class.countDocuments();
    const attendanceRecords = await Attendance.find();
    const presentRecords = attendanceRecords.filter(
      (record) => record.status === "present",
    ).length;
    const averageAttendance =
      attendanceRecords.length === 0
        ? 0
        : Number(((presentRecords / attendanceRecords.length) * 100).toFixed(2));

    res.json({
      totalStudents,
      totalProfessors,
      totalCourses,
      totalClasses,
      averageAttendance,
    });
  } catch (err) {
    console.error("GetDashboardStats error:", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to get statistics" });
  }
};

module.exports = {
  getAllStudents,
  getAllProfessors,
  createUser,
  updateUser,
  deleteUser,
  getDashboardStats,
};
