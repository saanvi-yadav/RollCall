const User = require("../models/User");
const Course = require("../models/Course");
const Class = require("../models/Class");
const Attendance = require("../models/Attendance");
const bcrypt = require("bcryptjs");

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
    const { name, email, role } = req.body;

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

    // Generate default password
    const defaultPassword = "Password@123";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: `User created with default password: ${defaultPassword}`,
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
    const { name, email, role } = req.body;

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

    await user.save();
    res.json(user);
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

    res.json({
      totalStudents,
      totalProfessors,
      totalCourses,
      totalClasses,
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
