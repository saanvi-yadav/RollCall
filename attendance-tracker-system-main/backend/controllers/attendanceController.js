const Attendance = require("../models/Attendance");

const markAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.create({
      user: req.user._id,
      status: req.body.status || "present",
    });

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: "Failed to mark attendance" });
  }
};

const getMyAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({ user: req.user._id }).sort({
      date: -1,
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch attendance" });
  }
};

const getAttendanceStats = async (req, res) => {
  try {
    const records = await Attendance.find({ user: req.user._id });

    const totalDays = records.length;

    const present = records.filter(
      (record) => record.status === "present",
    ).length;

    const absent = records.filter(
      (record) => record.status === "absent",
    ).length;

    const attendancePercentage =
      totalDays === 0 ? 0 : ((present / totalDays) * 100).toFixed(2);

    res.json({
      totalDays,
      present,
      absent,
      attendancePercentage,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to calculate attendance stats",
    });
  }
};

// Get attendance records by date
const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const records = await Attendance.find({
      user: req.user._id,
      date: { $gte: startDate, $lt: endDate },
    });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch attendance" });
  }
};

// Get all attendance records (for admin/professor)
const getAllAttendanceRecords = async (req, res) => {
  try {
    const records = await Attendance.find()
      .populate("user", "name email role")
      .sort({ date: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch attendance records" });
  }
};

// Get attendance for a specific student
const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const records = await Attendance.find({ user: studentId }).sort({
      date: -1,
    });

    const totalDays = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const attendancePercentage =
      totalDays === 0 ? 0 : ((present / totalDays) * 100).toFixed(2);

    res.json({
      records,
      stats: {
        totalDays,
        present,
        absent,
        attendancePercentage,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch student attendance" });
  }
};

module.exports = {
  markAttendance,
  getMyAttendance,
  getAttendanceStats,
  getAttendanceByDate,
  getAllAttendanceRecords,
  getStudentAttendance,
};
