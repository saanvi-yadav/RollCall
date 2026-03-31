const Attendance = require("../models/Attendance");
const Class = require("../models/Class");

const buildAttendanceQuery = (user) => {
  if (user.role === "professor") {
    return { professor: user._id };
  }

  if (user.role === "student") {
    return { user: user._id };
  }

  return {};
};

const applyAttendanceFilters = (baseQuery, queryParams = {}) => {
  const query = { ...baseQuery };

  if (queryParams.studentId) {
    query.user = queryParams.studentId;
  }

  if (queryParams.classId) {
    query.class = queryParams.classId;
  }

  if (queryParams.course) {
    query.course = queryParams.course;
  }

  if (queryParams.status) {
    query.status = queryParams.status;
  }

  if (queryParams.date) {
    query.date = { $gte: startOfDay(queryParams.date), $lt: endOfDay(queryParams.date) };
  }

  if (queryParams.fromDate || queryParams.toDate) {
    query.date = {
      ...(query.date || {}),
      ...(queryParams.fromDate ? { $gte: startOfDay(queryParams.fromDate) } : {}),
      ...(queryParams.toDate ? { $lt: endOfDay(queryParams.toDate) } : {}),
    };
  }

  return query;
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
};

const getObjectIdString = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value._id) {
    return String(value._id);
  }

  return String(value);
};

const buildSessionSummary = (records) => {
  if (!records.length) {
    return null;
  }

  const presentCount = records.filter((record) => record.status === "present").length;
  const totalCount = records.length;
  const first = records[0];
  const classId = getObjectIdString(first.class);

  return {
    id: `${classId || "general"}-${startOfDay(first.date).toISOString()}`,
    classId: classId || null,
    subject: first.subject || "General Attendance",
    course: first.course || "",
    semester: first.semester || "",
    section: first.section || "",
    date: first.date,
    presentCount,
    absentCount: totalCount - presentCount,
    totalCount,
    percentage: totalCount === 0 ? 0 : Number(((presentCount / totalCount) * 100).toFixed(2)),
    students: records.map((record) => ({
      attendanceId: record._id,
      studentId: getObjectIdString(record.user),
      name: record.user?.name || "Unknown Student",
      email: record.user?.email || "",
      status: record.status,
    })),
  };
};

const markAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.create({
      user: req.user._id,
      status: req.body.status || "present",
    });

    res.status(201).json(attendance);
  } catch {
    res.status(500).json({ message: "Failed to mark attendance" });
  }
};

const getMyAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({ user: req.user._id })
      .sort({
        date: -1,
      })
      .populate("class", "subject course semester section");
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch attendance" });
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
  } catch (err) {
    res.status(500).json({
      message: err.message || "Failed to calculate attendance stats",
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

    const startDate = startOfDay(date);
    const endDate = endOfDay(date);

    const records = await Attendance.find({
      user: req.user._id,
      date: { $gte: startDate, $lt: endDate },
    });

    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch attendance" });
  }
};

// Get all attendance records (for admin/professor)
const getAllAttendanceRecords = async (req, res) => {
  try {
    const records = await Attendance.find(
      applyAttendanceFilters(buildAttendanceQuery(req.user), req.query),
    )
      .populate("user", "name email role")
      .populate("class", "subject course semester section")
      .sort({ date: -1 });

    const groupedRecords = new Map();

    records.forEach((record) => {
      const sessionDate = startOfDay(record.date).toISOString();
      const sessionKey = `${record.class?._id || "general"}-${sessionDate}`;

      if (!groupedRecords.has(sessionKey)) {
        groupedRecords.set(sessionKey, []);
      }

      groupedRecords.get(sessionKey).push({
        ...record.toObject(),
        subject: record.subject || record.class?.subject || "",
        course: record.course || record.class?.course || "",
        semester: record.semester || record.class?.semester || "",
        section: record.section || record.class?.section || "",
      });
    });

    const summaries = [...groupedRecords.values()]
      .map((sessionRecords) => buildSessionSummary(sessionRecords))
      .filter(Boolean)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(summaries);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch attendance records" });
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
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch student attendance" });
  }
};

const getClassAttendanceReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const classData = await Class.findById(classId).populate("students", "name email");

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const records = await Attendance.find({ class: classId }).sort({ date: -1 });
    const totalSessions = new Set(
      records.map((record) => startOfDay(record.date).toISOString()),
    ).size;

    const studentStats = classData.students.map((student) => {
      const studentRecords = records.filter(
        (record) => String(record.user) === String(student._id),
      );
      const present = studentRecords.filter((record) => record.status === "present").length;
      const absent = studentRecords.filter((record) => record.status === "absent").length;
      const total = present + absent;
      const attendancePercentage =
        total === 0 ? 0 : Number(((present / total) * 100).toFixed(2));

      return {
        studentId: student._id,
        name: student.name,
        email: student.email,
        totalClasses: total,
        present,
        absent,
        attendancePercentage,
      };
    });

    const sortedPercentages = studentStats
      .map((item) => item.attendancePercentage)
      .sort((a, b) => b - a);
    const averageAttendance =
      studentStats.length === 0
        ? 0
        : Number(
            (
              studentStats.reduce((sum, item) => sum + item.attendancePercentage, 0) /
              studentStats.length
            ).toFixed(2),
          );

    res.json({
      classId: classData._id,
      subject: classData.subject,
      course: classData.course,
      semester: classData.semester,
      section: classData.section,
      totalStudents: classData.students.length,
      totalSessions,
      students: studentStats,
      summary: {
        highestAttendance: sortedPercentages[0] || 0,
        averageAttendance,
        lowestAttendance: sortedPercentages[sortedPercentages.length - 1] || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch class attendance report" });
  }
};

const getClassAttendanceSession = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const sessionRecords = await Attendance.find({
      class: classId,
      date: { $gte: startOfDay(date), $lt: endOfDay(date) },
    })
      .populate("user", "name email role")
      .sort({ date: -1 });

    const summary = buildSessionSummary(sessionRecords.map((record) => record.toObject()));
    res.json(summary || { students: [], totalCount: 0, presentCount: 0, absentCount: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch class attendance session" });
  }
};

module.exports = {
  markAttendance,
  getMyAttendance,
  getAttendanceStats,
  getAttendanceByDate,
  getAllAttendanceRecords,
  getStudentAttendance,
  getClassAttendanceReport,
  getClassAttendanceSession,
};
