const Notification = require("../models/Notification");
const Class = require("../models/Class");
const Course = require("../models/Course");

const normalizeValue = (value) => (value ? String(value).trim() : "");
const normalizeSection = (value) => normalizeValue(value).toUpperCase();

const matchesTargeting = (notification, context) => {
  const {
    classIds,
    courseIds,
    semesterValues,
    sectionValues,
  } = context;

  if (notification.targetClass?._id) {
    const classId = String(notification.targetClass._id);
    if (!classIds.has(classId)) {
      return false;
    }
  }

  if (notification.targetCourse?._id) {
    const courseId = String(notification.targetCourse._id);
    if (!courseIds.has(courseId)) {
      return false;
    }
  }

  if (notification.targetSemester) {
    if (!semesterValues.has(normalizeValue(notification.targetSemester))) {
      return false;
    }
  }

  if (notification.targetSection) {
    if (!sectionValues.has(normalizeSection(notification.targetSection))) {
      return false;
    }
  }

  return true;
};

const getNotifications = async (req, res) => {
  try {
    const baseQuery =
      req.user.role === "admin"
        ? {}
        : {
            $or: [{ targetRoles: req.user.role }, { author: req.user._id }],
          };

    const notifications = await Notification.find(baseQuery)
      .populate("author", "name email role")
      .populate("targetCourse", "name code semester department")
      .populate("targetClass", "subject course semester section scheduleDate startTime endTime room")
      .sort({ createdAt: -1 });

    const context = {
      classIds: new Set(),
      courseIds: new Set(),
      semesterValues: new Set(),
      sectionValues: new Set(),
    };

    if (req.user.role === "student") {
      const studentClasses = await Class.find({ students: req.user._id }).select(
        "_id courseRef semester section",
      );
      studentClasses.forEach((classItem) => {
        context.classIds.add(String(classItem._id));
        if (classItem.courseRef) {
          context.courseIds.add(String(classItem.courseRef));
        }
        if (classItem.semester) {
          context.semesterValues.add(normalizeValue(classItem.semester));
        }
        if (classItem.section) {
          context.sectionValues.add(normalizeSection(classItem.section));
        }
      });

      if (req.user.semester) {
        context.semesterValues.add(normalizeValue(req.user.semester));
      }
      if (req.user.section) {
        context.sectionValues.add(normalizeSection(req.user.section));
      }
    }

    if (req.user.role === "professor") {
      const [professorClasses, professorCourses] = await Promise.all([
        Class.find({ professor: req.user._id }).select("_id courseRef semester section"),
        Course.find({ professor: req.user._id }).select("_id semester"),
      ]);

      professorClasses.forEach((classItem) => {
        context.classIds.add(String(classItem._id));
        if (classItem.courseRef) {
          context.courseIds.add(String(classItem.courseRef));
        }
        if (classItem.semester) {
          context.semesterValues.add(normalizeValue(classItem.semester));
        }
        if (classItem.section) {
          context.sectionValues.add(normalizeSection(classItem.section));
        }
      });

      professorCourses.forEach((course) => {
        context.courseIds.add(String(course._id));
        if (course.semester) {
          context.semesterValues.add(normalizeValue(course.semester));
        }
      });
    }

    res.json(
      notifications.filter((notification) => {
        if (String(notification.author?._id || notification.author) === String(req.user._id)) {
          return true;
        }

        if (!notification.targetRoles.includes(req.user.role)) {
          return false;
        }

        return matchesTargeting(notification, context);
      }),
    );
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to fetch notifications" });
  }
};

const createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      targetRoles,
      targetCourse,
      targetClass,
      targetSemester,
      targetSection,
    } = req.body;

    if (!title || !message || !Array.isArray(targetRoles) || targetRoles.length === 0) {
      return res.status(400).json({
        message: "Title, message, and at least one target role are required",
      });
    }

    let resolvedCourse = null;
    let resolvedClass = null;

    if (targetCourse) {
      const course = await Course.findById(targetCourse).select("_id");
      if (!course) {
        return res.status(404).json({ message: "Selected course was not found" });
      }
      resolvedCourse = course._id;
    }

    if (targetClass) {
      const classRecord = await Class.findById(targetClass).select("_id");
      if (!classRecord) {
        return res.status(404).json({ message: "Selected class was not found" });
      }
      resolvedClass = classRecord._id;
    }

    const notification = await Notification.create({
      title,
      message,
      targetRoles,
      author: req.user._id,
      targetCourse: resolvedCourse,
      targetClass: resolvedClass,
      targetSemester: normalizeValue(targetSemester),
      targetSection: normalizeSection(targetSection),
    });

    await notification.populate([
      { path: "author", select: "name email role" },
      { path: "targetCourse", select: "name code semester department" },
      { path: "targetClass", select: "subject course semester section scheduleDate startTime endTime room" },
    ]);
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create notification" });
  }
};

module.exports = {
  getNotifications,
  createNotification,
};
