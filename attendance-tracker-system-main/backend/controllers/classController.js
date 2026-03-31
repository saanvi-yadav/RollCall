const Class = require("../models/Class");
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");
const User = require("../models/User");
const AcademicConfig = require("../models/AcademicConfig");

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

const normalizeValue = (value) => (value ? String(value).trim() : "");
const normalizeSection = (value) => normalizeValue(value).toUpperCase();
const weekdayValues = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const getEmailPrefix = (email = "") =>
  String(email).trim().toLowerCase().split("@")[0] || "";
const compareAcademicIds = (left = "", right = "") =>
  left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });

const normalizeWeekdays = (weekdays = []) =>
  [...new Set(
    (Array.isArray(weekdays) ? weekdays : [])
      .map((day) => normalizeValue(day))
      .filter((day) => weekdayOrder.includes(day)),
  )].sort((left, right) => weekdayOrder.indexOf(left) - weekdayOrder.indexOf(right));

const resolveWeekdays = (weekdays = [], fallbackDate = null) => {
  const normalizedWeekdays = normalizeWeekdays(weekdays);
  if (normalizedWeekdays.length > 0) {
    return normalizedWeekdays;
  }

  if (!fallbackDate) {
    return [];
  }

  const fallback = new Date(fallbackDate);
  if (Number.isNaN(fallback.getTime())) {
    return [];
  }

  return [weekdayValues[fallback.getDay()]];
};

const getFirstRecurringDate = (termStartDate, weekdays = []) => {
  const startDate = startOfDay(termStartDate);
  const normalizedWeekdays = resolveWeekdays(weekdays, startDate);

  if (!normalizedWeekdays.length) {
    return startDate;
  }

  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(startDate);
    candidate.setDate(startDate.getDate() + offset);
    const weekdayLabel = weekdayValues[candidate.getDay()];
    if (normalizedWeekdays.includes(weekdayLabel)) {
      return startOfDay(candidate);
    }
  }

  return startDate;
};

const getScheduleSortDate = (classItem) =>
  classItem.termStartDate || classItem.scheduleDate || classItem.createdAt || new Date(0);

const getBlockedAcademicEvent = async (dateValue) => {
  const config = await AcademicConfig.findOne({ key: "default" }).select("academicEvents");
  if (!config?.academicEvents?.length) {
    return null;
  }

  const sessionDate = startOfDay(dateValue);
  return (
    config.academicEvents.find((event) => {
      const startDate = startOfDay(event.startDate);
      const endDate = startOfDay(event.endDate);
      return sessionDate >= startDate && sessionDate <= endDate;
    }) || null
  );
};

const buildScheduleFields = ({
  termStartDate,
  termEndDate,
  weekdays,
  scheduleDate,
}) => {
  const normalizedStartDate = termStartDate || scheduleDate;
  const normalizedEndDate = termEndDate || normalizedStartDate;
  const normalizedWeekdays = resolveWeekdays(weekdays, normalizedStartDate);

  if (!normalizedStartDate || !normalizedEndDate || !normalizedWeekdays.length) {
    throw new Error("Recurring timetable needs term dates and at least one weekday");
  }

  const startDate = startOfDay(normalizedStartDate);
  const endDate = startOfDay(normalizedEndDate);

  if (endDate < startDate) {
    throw new Error("Term end date cannot be earlier than term start date");
  }

  return {
    termStartDate: startDate,
    termEndDate: endDate,
    weekdays: normalizedWeekdays,
    scheduleDate: getFirstRecurringDate(startDate, normalizedWeekdays),
    scheduleType: "weekly",
  };
};

const validateClassStudents = async (studentIds = [], semester, section) => {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return [];
  }

  const studentDocs = await User.find({
    _id: { $in: studentIds },
    role: "student",
  }).select("_id name email semester section");

  if (studentDocs.length !== studentIds.length) {
    throw new Error("One or more selected users are not valid students");
  }

  const normalizedSemester = normalizeValue(semester);
  const normalizedSection = normalizeSection(section);
  const invalidStudents = studentDocs.filter(
    (student) =>
      normalizeValue(student.semester) !== normalizedSemester ||
      normalizeSection(student.section) !== normalizedSection,
  );

  if (invalidStudents.length > 0) {
    const names = invalidStudents.map((student) => student.name).join(", ");
    throw new Error(
      `Selected students do not match semester ${normalizedSemester} section ${normalizedSection}: ${names}`,
    );
  }

  return studentDocs;
};

// Get all classes
const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("courseRef", "name code semester department")
      .populate("professor", "name email")
      .populate("students", "name email semester section department");
    classes.sort((a, b) => new Date(getScheduleSortDate(a)) - new Date(getScheduleSortDate(b)));
    res.json(classes);
  } catch (err) {
    console.error("GetAllClasses error:", err);
    res.status(500).json({ message: err.message || "Failed to get classes" });
  }
};

// Get professor's classes
const getProfessorClasses = async (req, res) => {
  try {
    const classes = await Class.find({ professor: req.user._id })
      .populate("courseRef", "name code semester department")
      .populate("students", "name email semester section department")
      .sort({ termStartDate: 1, scheduleDate: 1, startTime: 1 });
    res.json(classes);
  } catch (err) {
    console.error("GetProfessorClasses error:", err);
    res.status(500).json({ message: err.message || "Failed to get classes" });
  }
};

// Get student's classes
const getStudentClasses = async (req, res) => {
  try {
    const classes = await Class.find({ students: req.user._id })
      .populate("courseRef", "name code semester department")
      .populate("professor", "name email")
      .populate("students", "name email semester section department")
      .sort({ termStartDate: 1, scheduleDate: 1, startTime: 1 });
    res.json(classes);
  } catch (err) {
    console.error("GetStudentClasses error:", err);
    res.status(500).json({ message: err.message || "Failed to get classes" });
  }
};

// Create class
const createClass = async (req, res) => {
  try {
    const {
      subject,
      course,
      semester,
      section,
      courseRef,
      professor,
      students = [],
      scheduleDate,
      termStartDate,
      termEndDate,
      weekdays = [],
      startTime,
      endTime,
      room,
    } = req.body;

    if (!subject || !course || !semester || !section || !startTime || !endTime) {
      return res.status(400).json({ message: "All timetable fields are required" });
    }

    let resolvedProfessor = professor || req.user._id;
    let resolvedCourseRef = courseRef || null;

    if (courseRef) {
      const courseDoc = await Course.findById(courseRef).populate(
        "professor",
        "name email role",
      );

      if (!courseDoc) {
        return res.status(404).json({ message: "Course not found" });
      }

      resolvedCourseRef = courseDoc._id;
      if (!professor && courseDoc.professor?._id) {
        resolvedProfessor = courseDoc.professor._id;
      }
    }

    await validateClassStudents(students, semester, section);

    const scheduleFields = buildScheduleFields({
      termStartDate,
      termEndDate,
      weekdays,
      scheduleDate,
    });

    const newClass = await Class.create({
      subject,
      courseRef: resolvedCourseRef,
      course,
      semester: normalizeValue(semester),
      section: normalizeSection(section),
      professor: resolvedProfessor,
      students,
      ...scheduleFields,
      startTime,
      endTime,
      room,
    });

    await newClass.populate([
      { path: "courseRef", select: "name code semester department" },
      { path: "professor", select: "name email" },
      { path: "students", select: "name email semester section department" },
    ]);

    res.status(201).json(newClass);
  } catch (err) {
    console.error("CreateClass error:", err);
    res.status(500).json({ message: err.message || "Failed to create class" });
  }
};

const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subject,
      course,
      semester,
      section,
      courseRef,
      professor,
      students,
      scheduleDate,
      termStartDate,
      termEndDate,
      weekdays,
      startTime,
      endTime,
      room,
    } = req.body;

    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    if (courseRef !== undefined) {
      if (courseRef) {
        const courseDoc = await Course.findById(courseRef);
        if (!courseDoc) {
          return res.status(404).json({ message: "Course not found" });
        }
        classData.courseRef = courseDoc._id;
      } else {
        classData.courseRef = null;
      }
    }

    const nextSemester = semester !== undefined ? normalizeValue(semester) : classData.semester;
    const nextSection = section !== undefined ? normalizeSection(section) : classData.section;

    if (students !== undefined) {
      await validateClassStudents(students, nextSemester, nextSection);
      classData.students = students;
    } else if (
      (semester !== undefined || section !== undefined) &&
      Array.isArray(classData.students) &&
      classData.students.length > 0
    ) {
      await validateClassStudents(classData.students, nextSemester, nextSection);
    }

    if (subject) classData.subject = subject;
    if (course) classData.course = course;
    if (semester !== undefined) classData.semester = nextSemester;
    if (section !== undefined) classData.section = nextSection;
    if (professor) classData.professor = professor;
    const nextScheduleFields = buildScheduleFields({
      termStartDate: termStartDate !== undefined ? termStartDate : classData.termStartDate,
      termEndDate: termEndDate !== undefined ? termEndDate : classData.termEndDate,
      weekdays: weekdays !== undefined ? weekdays : classData.weekdays,
      scheduleDate: scheduleDate !== undefined ? scheduleDate : classData.scheduleDate,
    });

    classData.scheduleDate = nextScheduleFields.scheduleDate;
    classData.termStartDate = nextScheduleFields.termStartDate;
    classData.termEndDate = nextScheduleFields.termEndDate;
    classData.weekdays = nextScheduleFields.weekdays;
    classData.scheduleType = nextScheduleFields.scheduleType;
    if (startTime) classData.startTime = startTime;
    if (endTime) classData.endTime = endTime;
    if (room !== undefined) classData.room = room;

    await classData.save();
    await classData.populate([
      { path: "courseRef", select: "name code semester department" },
      { path: "professor", select: "name email" },
      { path: "students", select: "name email semester section department" },
    ]);

    res.json(classData);
  } catch (err) {
    console.error("UpdateClass error:", err);
    res.status(500).json({ message: err.message || "Failed to update class" });
  }
};

const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedClass = await Class.findByIdAndDelete(id);

    if (!deletedClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json({ message: "Class deleted successfully" });
  } catch (err) {
    console.error("DeleteClass error:", err);
    res.status(500).json({ message: err.message || "Failed to delete class" });
  }
};

// Add student to class
const addStudentToClass = async (req, res) => {
  try {
    const { classId, studentId } = req.body;

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    if (classData.students.includes(studentId)) {
      return res.status(400).json({ message: "Student already in this class" });
    }

    classData.students.push(studentId);
    await classData.save();

    await classData.populate("students", "name email semester section department");
    res.json(classData);
  } catch (err) {
    console.error("AddStudentToClass error:", err);
    res.status(500).json({ message: err.message || "Failed to add student" });
  }
};

// Get class students
const getClassStudents = async (req, res) => {
  try {
    const { classId } = req.params;
    const classData = await Class.findById(classId).populate(
      "students",
      "name email _id semester section department username",
    );

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const sortedStudents = classData.students
      .map((student) => ({
        ...student.toObject(),
        academicId: student.username || getEmailPrefix(student.email),
      }))
      .sort((a, b) => compareAcademicIds(a.academicId, b.academicId));

    res.json(sortedStudents);
  } catch (err) {
    console.error("GetClassStudents error:", err);
    res.status(500).json({ message: err.message || "Failed to get students" });
  }
};

// Mark attendance for class
const markClassAttendance = async (req, res) => {
  try {
    const { classId, attendanceData, date } = req.body;

    if (!classId || !attendanceData) {
      return res
        .status(400)
        .json({ message: "Class ID and attendance data are required" });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const sessionDate = date ? startOfDay(date) : startOfDay(new Date());
    const blockedEvent = await getBlockedAcademicEvent(sessionDate);
    if (blockedEvent) {
      return res.status(400).json({
        message: `Attendance cannot be marked on ${blockedEvent.type.replace("_", " ")}: ${blockedEvent.title}`,
      });
    }
    const results = [];

    for (const [studentId, status] of Object.entries(attendanceData)) {
      const attendance = await Attendance.create({
        user: studentId,
        class: classData._id,
        professor: classData.professor,
        status,
        subject: classData.subject,
        course: classData.course,
        semester: classData.semester,
        section: classData.section,
        date: sessionDate,
      });
      results.push(attendance);
    }

    res
      .status(201)
      .json({ message: "Attendance marked successfully", results });
  } catch (err) {
    console.error("MarkClassAttendance error:", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to mark attendance" });
  }
};

const updateClassAttendance = async (req, res) => {
  try {
    const { classId, attendanceData, date } = req.body;

    if (!classId || !attendanceData || !date) {
      return res.status(400).json({
        message: "Class ID, attendance data, and date are required",
      });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const sessionStart = startOfDay(date);
    const sessionEnd = endOfDay(date);
    const blockedEvent = await getBlockedAcademicEvent(sessionStart);
    if (blockedEvent) {
      return res.status(400).json({
        message: `Attendance cannot be updated on ${blockedEvent.type.replace("_", " ")}: ${blockedEvent.title}`,
      });
    }

    await Attendance.deleteMany({
      class: classId,
      date: { $gte: sessionStart, $lt: sessionEnd },
    });

    const results = [];

    for (const [studentId, status] of Object.entries(attendanceData)) {
      const attendance = await Attendance.create({
        user: studentId,
        class: classData._id,
        professor: classData.professor,
        status,
        subject: classData.subject,
        course: classData.course,
        semester: classData.semester,
        section: classData.section,
        date: sessionStart,
      });
      results.push(attendance);
    }

    res.json({ message: "Attendance updated successfully", results });
  } catch (err) {
    console.error("UpdateClassAttendance error:", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to update attendance" });
  }
};

module.exports = {
  getAllClasses,
  getProfessorClasses,
  getStudentClasses,
  createClass,
  updateClass,
  deleteClass,
  addStudentToClass,
  getClassStudents,
  markClassAttendance,
  updateClassAttendance,
};
