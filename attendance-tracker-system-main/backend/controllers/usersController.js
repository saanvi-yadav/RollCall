const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const VALID_ROLES = ["student", "professor", "admin"];

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = (role || "student").toLowerCase();
    const normalizedName = (name || "").trim();

    if (!normalizedName || !normalizedEmail || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    if (!VALID_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userPayload = {
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: normalizedRole,
    };

    // if frontend ever adds username field, this can be included safely
    if (req.body.username) {
      userPayload.username = req.body.username.trim();
    }

    const user = await User.create(userPayload);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error("RegisterUser error:", err);
    const message = err?.message || "Failed to register user";
    res.status(500).json({ message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const selectedRole = role ? role.toLowerCase() : "";

    if (!normalizedEmail || !password || !selectedRole) {
      return res
        .status(400)
        .json({ message: "Email, password and role are required" });
    }

    if (!VALID_ROLES.includes(selectedRole)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const effectiveRole = user.role || "student";

    if (!user.role) {
      user.role = effectiveRole;
      await user.save();
    }

    if (effectiveRole !== selectedRole) {
      return res
        .status(403)
        .json({ message: "Role mismatch for this account" });
    }

    const token = jwt.sign(
      { id: user._id, role: effectiveRole },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: effectiveRole,
      token,
    });
  } catch (err) {
    console.error("LoginUser error:", err);
    res.status(500).json({ message: err?.message || "Login failed" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("ChangePassword error:", err);
    res
      .status(500)
      .json({ message: err?.message || "Failed to change password" });
  }
};

module.exports = { registerUser, loginUser, changePassword };
