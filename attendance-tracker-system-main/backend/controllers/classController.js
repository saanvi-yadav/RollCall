const Class = require("../models/Class");
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");
const User = require("../models/User");

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
    classes.sort((a, b) => new Date(a.scheduleDate) - new Date(b.scheduleDate));
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
      .sort({ scheduleDate: 1, startTime: 1 });
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
      .sort({ scheduleDate: 1, startTime: 1 });
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
      startTime,
      endTime,
      room,
    } = req.body;

    if (!subject || !course || !semester || !section || !scheduleDate || !startTime || !endTime) {
      return res.status(400).json({ message: "All class schedule fields are required" });
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

    const newClass = await Class.create({
      subject,
      courseRef: resolvedCourseRef,
      course,
      semester: normalizeValue(semester),
      section: normalizeSection(section),
      professor: resolvedProfessor,
      students,
      scheduleDate,
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
    if (scheduleDate) classData.scheduleDate = scheduleDate;
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
      "name email _id semester section department",
    );

    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json(classData.students);
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
