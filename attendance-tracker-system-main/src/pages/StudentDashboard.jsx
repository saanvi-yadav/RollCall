import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/student-dashboard.css";
import { useTheme } from "../context/ThemeContext";
import {
  attendanceAPI,
  classAPI,
  clearAuthToken,
  clearCurrentUser,
  getCurrentUser,
  notificationAPI,
  settingsAPI,
  setCurrentUser,
  userAPI,
} from "../utils/apiClient";

const getAcademicId = (user = {}) =>
  user.username || user.email?.split("@")[0] || "Not Available";

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "ST";

const formatMonthKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatDayKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getMonthStart = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const formatMonthLabel = (dateValue) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(dateValue));

const formatDateLabel = (dateValue) =>
  dateValue ? new Date(dateValue).toLocaleDateString() : "Not set";

const weekdayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayByIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getWeekdayFromDate = (dateValue) => {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return weekdayByIndex[date.getDay()];
};

const getClassWeekdays = (classItem = {}) => {
  const values =
    Array.isArray(classItem.weekdays) && classItem.weekdays.length > 0
      ? classItem.weekdays
      : [getWeekdayFromDate(classItem.scheduleDate)].filter(Boolean);

  return [...new Set(values)].sort(
    (left, right) => weekdayOrder.indexOf(left) - weekdayOrder.indexOf(right),
  );
};

const calculateAttendanceTarget = (presentCount, totalCount, targetPercentage = 75) => {
  const targetRatio = targetPercentage / 100;

  if (totalCount === 0) {
    return {
      status: "no-data",
      canMissMore: 0,
      classesNeeded: 0,
    };
  }

  const currentRatio = presentCount / totalCount;

  if (currentRatio >= targetRatio) {
    const canMissMore = Math.max(
      0,
      Math.floor(presentCount / targetRatio - totalCount),
    );

    return {
      status: "safe",
      canMissMore,
      classesNeeded: 0,
    };
  }

  const classesNeeded = Math.max(
    0,
    Math.ceil((targetRatio * totalCount - presentCount) / (1 - targetRatio)),
  );

  return {
    status: "below",
    canMissMore: 0,
    classesNeeded,
  };
};

const calculateProjectedPercentage = (presentCount, totalCount, additionalAbsences = 0) => {
  const nextTotal = totalCount + additionalAbsences;
  if (nextTotal <= 0) {
    return 0;
  }

  return Number(((presentCount / nextTotal) * 100).toFixed(2));
};

const getPercentageColor = (percentage) => {
  if (percentage >= 90) return "#10b981";
  if (percentage >= 75) return "#f59e0b";
  return "#ef4444";
};

function StudentDashboard() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [currentUser, setCurrentUserState] = useState(() => getCurrentUser());

  const [studentData, setStudentData] = useState({
    name: currentUser?.name || "Student",
    studentId: getAcademicId(currentUser || {}),
    course: "Not Assigned",
    department: currentUser?.department || "Not Assigned",
    semester: currentUser?.semester || "Not Assigned",
    section: currentUser?.section || "Not Assigned",
    profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || "Student")}&size=150&background=6366f1&color=fff`,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showProfileSetupModal, setShowProfileSetupModal] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [attendanceStats, setAttendanceStats] = useState({
    totalClasses: 0,
    classesAttended: 0,
    classesMissed: 0,
    attendancePercentage: 0,
  });
  const [subjectAttendance, setSubjectAttendance] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [enrolledClasses, setEnrolledClasses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [profileSetupForm, setProfileSetupForm] = useState({
    name: currentUser?.name || "",
    studentId: getAcademicId(currentUser || {}),
    department: currentUser?.department || "",
    semester: currentUser?.semester || "",
    section: currentUser?.section || "",
  });
  const [profileSetupLoading, setProfileSetupLoading] = useState(false);
  const [profileSetupError, setProfileSetupError] = useState("");
  const [academicConfig, setAcademicConfig] = useState({
    departments: [],
    semesters: [],
    sections: [],
    academicEvents: [],
  });
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(() => getMonthStart());
  const profileMenuRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = showProfileSetupModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showProfileSetupModal]);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      setError("");

      try {
        const [statsResponse, attendanceResponse, classesResponse, notificationsResponse, academicConfigResponse] = await Promise.all([
          attendanceAPI.getAttendanceStats(),
          attendanceAPI.getMyAttendance(),
          classAPI.getStudentClasses(),
          notificationAPI.getNotifications(),
          settingsAPI.getAcademicConfig(),
        ]);

        setAttendanceStats({
          totalClasses: statsResponse.totalDays,
          classesAttended: statsResponse.present,
          classesMissed: statsResponse.absent,
          attendancePercentage: Number(statsResponse.attendancePercentage),
        });

        const normalizedHistory = attendanceResponse
          .slice()
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map((entry, index) => ({
            id: entry._id || `${entry.class?._id || "general"}-${index}`,
            date: entry.date,
            subject: entry.subject || entry.class?.subject || "General Attendance",
            course: entry.course || entry.class?.course || "",
            semester: entry.semester || entry.class?.semester || "",
            section: entry.section || entry.class?.section || "",
            classId: entry.class?._id || entry.class || null,
            status: entry.status === "present" ? "Present" : "Absent",
          }));

        setAttendanceHistory(normalizedHistory);
        setAcademicConfig({
          departments: academicConfigResponse.departments || [],
          semesters: academicConfigResponse.semesters || [],
          sections: academicConfigResponse.sections || [],
          academicEvents: academicConfigResponse.academicEvents || [],
        });

        const uniqueClasses = Array.from(
          new Map(
            classesResponse.map((classItem) => [
              `${classItem.subject}-${classItem.course}-${classItem.section}-${classItem.semester}`,
              classItem,
            ]),
          ).values(),
        );

        setEnrolledClasses(uniqueClasses);
        setNotifications(notificationsResponse);

        const groupedSubjects = new Map();
        normalizedHistory.forEach((record) => {
          const key = (record.subject || "General Attendance").trim().toLowerCase();
          if (!groupedSubjects.has(key)) {
            groupedSubjects.set(key, {
              id: key,
              name: record.subject,
              courses: new Set(),
              semesters: new Set(),
              sections: new Set(),
              totalClasses: 0,
              present: 0,
              absent: 0,
              percentage: 0,
              warning: false,
            });
          }

          const subject = groupedSubjects.get(key);
          if (record.course) {
            subject.courses.add(record.course);
          }
          if (record.semester) {
            subject.semesters.add(String(record.semester));
          }
          if (record.section) {
            subject.sections.add(record.section);
          }
          subject.totalClasses += 1;
          if (record.status === "Present") {
            subject.present += 1;
          } else {
            subject.absent += 1;
          }
        });

        const subjectCards = [...groupedSubjects.values()]
          .map((subject) => {
            const percentage =
              subject.totalClasses === 0
                ? 0
                : Number(((subject.present / subject.totalClasses) * 100).toFixed(2));

            return {
              ...subject,
              course: [...subject.courses].join(", "),
              semester: [...subject.semesters].join(", "),
              section: [...subject.sections].join(", "),
              percentage,
              warning: percentage < 75,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        setSubjectAttendance(subjectCards);

        const nextWarnings = [];
        if (Number(statsResponse.attendancePercentage) < 75) {
          nextWarnings.push({
            id: "overall",
            message: `Your overall attendance is ${statsResponse.attendancePercentage}%. Please improve to stay above 75%.`,
            percentage: Number(statsResponse.attendancePercentage),
          });
        }

        subjectCards
          .filter((subject) => subject.warning)
          .forEach((subject) => {
            nextWarnings.push({
              id: subject.id,
              message: `${subject.name} attendance is ${subject.percentage}%, which is below the 75% target.`,
              percentage: subject.percentage,
            });
          });

        setWarnings(nextWarnings);

        const primaryClass = classesResponse[0];
        setStudentData({
          name: currentUser?.name || "Student",
          studentId: getAcademicId(currentUser || {}),
          course: primaryClass?.course || "Not Assigned",
          department: currentUser?.department || "Not Assigned",
          semester: currentUser?.semester || primaryClass?.semester || "Not Assigned",
          section: currentUser?.section || primaryClass?.section || "Not Assigned",
          profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || "Student")}&size=150&background=6366f1&color=fff`,
        });
      } catch (err) {
        console.error("Student dashboard load error:", err);
        setError(err.message || "Unable to load attendance data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [currentUser]);

  useEffect(() => {
    const shouldCompleteProfile =
      currentUser?.role === "student" &&
      (!currentUser?.department || !currentUser?.section);

    setProfileSetupForm({
      name: currentUser?.name || "",
      studentId: getAcademicId(currentUser || {}),
      department: currentUser?.department || "",
      semester: currentUser?.semester || "",
      section: currentUser?.section || "",
    });
    setShowProfileSetupModal(Boolean(shouldCompleteProfile));
  }, [currentUser]);

  useEffect(() => {
    if (!showProfileMenu) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showProfileMenu]);

  const filteredHistory =
    activeFilter === "all"
      ? attendanceHistory
      : attendanceHistory.filter((record) => record.status === activeFilter);

  const calendarDays = useMemo(() => {
    const currentDate = selectedCalendarMonth;
    const monthKey = formatMonthKey(currentDate);
    const daysInMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    ).getDate();
    const monthlyRecords = attendanceHistory.filter(
      (record) => formatMonthKey(record.date) === monthKey,
    );

    const recordsByDay = new Map();
    monthlyRecords.forEach((record) => {
      const dayKey = formatDayKey(record.date);
      if (!recordsByDay.has(dayKey)) {
        recordsByDay.set(dayKey, []);
      }
      recordsByDay.get(dayKey).push(record.status);
    });

    const eventsByDay = new Map();
    (academicConfig.academicEvents || []).forEach((event) => {
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      const cursor = new Date(startDate);

      while (cursor <= endDate) {
        const dayKey = formatDayKey(cursor);
        eventsByDay.set(dayKey, event);
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const dayKey = `${monthKey}-${String(dayNumber).padStart(2, "0")}`;
      const statuses = recordsByDay.get(dayKey) || [];
      const event = eventsByDay.get(dayKey) || null;
      const hasClass = statuses.length > 0;
      const allPresent = hasClass && statuses.every((status) => status === "Present");
      const eventColor =
        event?.type === "holiday"
          ? "#f59e0b"
          : event?.type === "exam"
            ? "#8b5cf6"
            : event?.type === "no_class"
              ? "#06b6d4"
              : null;

      return {
        dayNumber,
        color: eventColor || (!hasClass ? "#e5e7eb" : allPresent ? "#10b981" : "#ef4444"),
        label: event?.title || "",
      };
    });
  }, [academicConfig.academicEvents, attendanceHistory, selectedCalendarMonth]);

  const semesterInsight = useMemo(() => {
    const activeSemester = String(studentData.semester || currentUser?.semester || "").trim();
    const semesterRecords = activeSemester
      ? attendanceHistory.filter(
          (record) => String(record.semester || "").trim() === activeSemester,
        )
      : attendanceHistory;

    const presentCount = semesterRecords.filter((record) => record.status === "Present").length;
    const totalCount = semesterRecords.length;
    const attendancePercentage =
      totalCount === 0 ? 0 : Number(((presentCount / totalCount) * 100).toFixed(2));

    const subjectSummary = new Map();
    semesterRecords.forEach((record) => {
      const key = (record.subject || "General Attendance").trim();
      if (!subjectSummary.has(key)) {
        subjectSummary.set(key, {
          name: key,
          totalClasses: 0,
          present: 0,
        });
      }

      const subject = subjectSummary.get(key);
      subject.totalClasses += 1;
      if (record.status === "Present") {
        subject.present += 1;
      }
    });

    const strongestSubject = [...subjectSummary.values()]
      .map((subject) => ({
        ...subject,
        percentage:
          subject.totalClasses === 0
            ? 0
            : Number(((subject.present / subject.totalClasses) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.percentage - a.percentage)[0];

    return {
      totalCount,
      presentCount,
      attendancePercentage,
      strongestSubject: strongestSubject?.name || "No subject data",
    };
  }, [attendanceHistory, currentUser?.semester, studentData.semester]);
  const recentNotifications = useMemo(
    () =>
      [...notifications]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 5),
    [notifications],
  );
  const activeSemester = String(studentData.semester || currentUser?.semester || "").trim();
  const semesterRecords = useMemo(
    () =>
      activeSemester
        ? attendanceHistory.filter(
            (record) => String(record.semester || "").trim() === activeSemester,
          )
        : attendanceHistory,
    [activeSemester, attendanceHistory],
  );
  const semesterTrendData = useMemo(() => {
    const grouped = new Map();

    attendanceHistory.forEach((record) => {
      const semesterKey = String(record.semester || "Unassigned").trim() || "Unassigned";
      if (!grouped.has(semesterKey)) {
        grouped.set(semesterKey, {
          semester: semesterKey,
          total: 0,
          present: 0,
        });
      }

      const item = grouped.get(semesterKey);
      item.total += 1;
      if (record.status === "Present") {
        item.present += 1;
      }
    });

    return [...grouped.values()]
      .map((item) => ({
        ...item,
        percentage:
          item.total === 0 ? 0 : Number(((item.present / item.total) * 100).toFixed(2)),
      }))
      .sort((left, right) => {
        const leftValue = Number(left.semester);
        const rightValue = Number(right.semester);
        if (!Number.isNaN(leftValue) && !Number.isNaN(rightValue)) {
          return leftValue - rightValue;
        }

        return left.semester.localeCompare(right.semester);
      });
  }, [attendanceHistory]);
  const timetableEntries = useMemo(
    () =>
      [...enrolledClasses]
        .map((classItem) => ({
          ...classItem,
          weekdayLabel: getClassWeekdays(classItem).join(", ") || "Not scheduled",
          termLabel: `${formatDateLabel(classItem.termStartDate || classItem.scheduleDate)} - ${formatDateLabel(
            classItem.termEndDate || classItem.scheduleDate,
          )}`,
        }))
        .sort((left, right) => {
          const leftDays = getClassWeekdays(left);
          const rightDays = getClassWeekdays(right);
          const leftIndex = leftDays.length ? weekdayOrder.indexOf(leftDays[0]) : 99;
          const rightIndex = rightDays.length ? weekdayOrder.indexOf(rightDays[0]) : 99;
          if (leftIndex !== rightIndex) {
            return leftIndex - rightIndex;
          }

          return String(left.startTime || "").localeCompare(String(right.startTime || ""));
        }),
    [enrolledClasses],
  );
  const attendancePlanner = useMemo(() => {
    const overall = calculateAttendanceTarget(
      semesterRecords.filter((record) => record.status === "Present").length,
      semesterRecords.length,
    );
    const overallPresent = semesterRecords.filter((record) => record.status === "Present").length;
    const overallTotal = semesterRecords.length;

    const subjects = subjectAttendance.map((subject) => ({
      ...subject,
      planner: calculateAttendanceTarget(subject.present, subject.totalClasses),
      prediction:
        subject.totalClasses > 0
          ? {
              afterTwoMisses: calculateProjectedPercentage(subject.present, subject.totalClasses, 2),
            }
          : null,
    }));

    return {
      overall: {
        ...overall,
        afterTwoMisses:
          overallTotal > 0
            ? calculateProjectedPercentage(overallPresent, overallTotal, 2)
            : 0,
      },
      subjects,
    };
  }, [semesterRecords, subjectAttendance]);

  const dismissWarning = (id) => {
    setWarnings((prevWarnings) => prevWarnings.filter((warning) => warning.id !== id));
  };

  const handleLogout = () => {
    clearAuthToken();
    clearCurrentUser();
    navigate("/login");
  };

  const handleChangePasswordOpen = () => {
    setShowChangePasswordModal(true);
    setShowProfileMenu(false);
    setChangePasswordError("");
    setChangePasswordSuccess("");
  };

  const handleChangePasswordSubmit = async (event) => {
    event.preventDefault();
    setChangePasswordError("");
    setChangePasswordSuccess("");

    if (
      !changePasswordForm.currentPassword ||
      !changePasswordForm.newPassword ||
      !changePasswordForm.confirmNewPassword
    ) {
      setChangePasswordError("All fields are required");
      return;
    }

    if (changePasswordForm.newPassword !== changePasswordForm.confirmNewPassword) {
      setChangePasswordError("New passwords do not match");
      return;
    }

    if (changePasswordForm.newPassword.length < 6) {
      setChangePasswordError("New password must be at least 6 characters");
      return;
    }

    setChangePasswordLoading(true);

    try {
      await userAPI.changePassword(
        changePasswordForm.currentPassword,
        changePasswordForm.newPassword,
      );
      setChangePasswordSuccess("Password changed successfully!");
      setChangePasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      setTimeout(() => setShowChangePasswordModal(false), 1500);
    } catch (err) {
      setChangePasswordError(err.message || "Failed to change password");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleProfileSetupSubmit = async (event) => {
    event.preventDefault();
    setProfileSetupError("");

    if (!profileSetupForm.name || !profileSetupForm.department || !profileSetupForm.section) {
      setProfileSetupError("Name, department, and section are required");
      return;
    }

    setProfileSetupLoading(true);
    try {
      const updatedUser = await userAPI.updateProfile({
        name: profileSetupForm.name.trim(),
        department: profileSetupForm.department.trim(),
        semester: profileSetupForm.semester.trim(),
        section: profileSetupForm.section.trim().toUpperCase(),
      });

      setCurrentUser({
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        username: updatedUser.username,
        department: updatedUser.department,
        semester: updatedUser.semester,
        section: updatedUser.section,
      });
      setCurrentUserState({
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        username: updatedUser.username,
        department: updatedUser.department,
        semester: updatedUser.semester,
        section: updatedUser.section,
      });

      setStudentData((prev) => ({
        ...prev,
        name: updatedUser.name,
        studentId: updatedUser.username || getAcademicId(updatedUser),
        department: updatedUser.department || "Not Assigned",
        semester: updatedUser.semester || "Not Assigned",
        section: updatedUser.section || "Not Assigned",
      }));
      setShowProfileSetupModal(false);
    } catch (err) {
      setProfileSetupError(err.message || "Failed to save profile");
    } finally {
      setProfileSetupLoading(false);
    }
  };

  const downloadAttendanceReport = () => {
    const reportLines = [
      ["Student Name", studentData.name],
      ["Student ID", studentData.studentId],
      ["Department", studentData.department],
      ["Semester", studentData.semester],
      ["Section", studentData.section],
      [],
      ["Subject", "Present", "Absent", "Total", "Percentage"],
      ...subjectAttendance.map((subject) => [
        subject.name,
        subject.present,
        subject.absent,
        subject.totalClasses,
        `${subject.percentage}%`,
      ]),
      [],
      ["Date", "Subject", "Course", "Section", "Status"],
      ...attendanceHistory.map((record) => [
        new Date(record.date).toLocaleDateString(),
        record.subject,
        record.course || "General",
        record.section || "-",
        record.status,
      ]),
    ];

    const csvContent = reportLines
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${studentData.studentId || "student"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="student-dashboard">
      <div className="dashboard-topbar">
        <div className="topbar-left">
          <h1>📚 Student Portal</h1>
        </div>
        <div className="topbar-right">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? "☀️" : "🌙"}
          </button>
          <div className="profile-menu-wrapper" ref={profileMenuRef}>
            <button
              className={`account-trigger student ${showProfileMenu ? "open" : ""}`}
              onClick={() => setShowProfileMenu((prev) => !prev)}
              title="Open account menu"
              type="button"
            >
              <div className="account-trigger-avatar">
                <img
                  src={studentData.profilePhoto}
                  alt={studentData.name}
                  className="account-trigger-image"
                />
              </div>
              <div className="account-trigger-copy">
                <span className="account-trigger-name">{studentData.name}</span>
                <span className="account-trigger-role">Student</span>
              </div>
              <span className="account-trigger-caret">{showProfileMenu ? "˄" : "˅"}</span>
            </button>
            <button
              className="profile-menu-btn"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              title="Profile settings"
            >
              ⚙️ Settings
            </button>
            {showProfileMenu && (
              <div className="profile-menu-dropdown">
                <div className="profile-menu-summary">
                  <div className="profile-menu-avatar student">{getInitials(studentData.name)}</div>
                  <div className="profile-menu-summary-copy">
                    <strong>{studentData.name}</strong>
                    <span>{currentUser?.email || "Student account"}</span>
                  </div>
                </div>
                <button className="menu-item" onClick={toggleTheme} type="button">
                  <span>Appearance</span>
                  <span>{isDark ? "Light" : "Dark"}</span>
                </button>
                <button className="menu-item" onClick={handleChangePasswordOpen}>
                  🔐 Change Password
                </button>
                <button className="menu-item danger" onClick={handleLogout}>
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showChangePasswordModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowChangePasswordModal(false)}
        >
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button
                className="modal-close"
                onClick={() => setShowChangePasswordModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="change-password-form">
              {changePasswordError && <div className="form-error">{changePasswordError}</div>}
              {changePasswordSuccess && (
                <div className="form-success">{changePasswordSuccess}</div>
              )}

              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={changePasswordForm.currentPassword}
                  onChange={(event) =>
                    setChangePasswordForm((prev) => ({
                      ...prev,
                      currentPassword: event.target.value,
                    }))
                  }
                  disabled={changePasswordLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={changePasswordForm.newPassword}
                  onChange={(event) =>
                    setChangePasswordForm((prev) => ({
                      ...prev,
                      newPassword: event.target.value,
                    }))
                  }
                  disabled={changePasswordLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmNewPassword">Confirm New Password</label>
                <input
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  type="password"
                  value={changePasswordForm.confirmNewPassword}
                  onChange={(event) =>
                    setChangePasswordForm((prev) => ({
                      ...prev,
                      confirmNewPassword: event.target.value,
                    }))
                  }
                  disabled={changePasswordLoading}
                />
              </div>

              <button className="btn-submit" type="submit" disabled={changePasswordLoading}>
                {changePasswordLoading ? "Changing..." : "Change Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showProfileSetupModal && (
        <div className="profile-setup-overlay">
          <div className="profile-setup-shell" onClick={(event) => event.stopPropagation()}>
            <div className="profile-setup-hero">
              <div>
                <p className="profile-setup-kicker">Student Onboarding</p>
                <h2>Complete Your Profile</h2>
                <p className="profile-setup-copy">
                  Add your academic details once so classes, attendance, and announcements map correctly to you.
                </p>
              </div>
              <div className="profile-setup-id-card">
                <span className="detail-label">Student ID</span>
                <strong>{profileSetupForm.studentId}</strong>
                <span>This is linked to your login email.</span>
              </div>
            </div>

            <form onSubmit={handleProfileSetupSubmit} className="profile-setup-form">
              {profileSetupError && <div className="form-error">{profileSetupError}</div>}

              <div className="profile-setup-grid">
                <div className="form-group">
                  <label htmlFor="studentProfileName">Full Name</label>
                  <input
                    id="studentProfileName"
                    value={profileSetupForm.name}
                    onChange={(event) =>
                      setProfileSetupForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    disabled={profileSetupLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="studentProfileDepartment">Department</label>
                  <select
                    id="studentProfileDepartment"
                    value={profileSetupForm.department}
                    onChange={(event) =>
                      setProfileSetupForm((prev) => ({ ...prev, department: event.target.value }))
                    }
                    disabled={profileSetupLoading}
                  >
                    <option value="">Select department</option>
                    {academicConfig.departments.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="studentProfileSemester">Semester</label>
                  <select
                    id="studentProfileSemester"
                    value={profileSetupForm.semester}
                    onChange={(event) =>
                      setProfileSetupForm((prev) => ({ ...prev, semester: event.target.value }))
                    }
                    disabled={profileSetupLoading}
                  >
                    <option value="">Select semester</option>
                    {academicConfig.semesters.map((semester) => (
                      <option key={semester} value={semester}>{semester}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="studentProfileSection">Section</label>
                  <select
                    id="studentProfileSection"
                    value={profileSetupForm.section}
                    onChange={(event) =>
                      setProfileSetupForm((prev) => ({
                        ...prev,
                        section: event.target.value.toUpperCase(),
                      }))
                    }
                    disabled={profileSetupLoading}
                  >
                    <option value="">Select section</option>
                    {academicConfig.sections.map((section) => (
                      <option key={section} value={section}>{section}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="profile-setup-actions">
                <div className="profile-setup-hint">
                  These details are used to assign your timetable, attendance records, and announcements.
                </div>
                <button className="btn-submit" type="submit" disabled={profileSetupLoading}>
                  {profileSetupLoading ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="dashboard-header">
        <h1>Student Dashboard</h1>
        <p>Welcome back! Here&apos;s your live attendance overview.</p>
      </div>

      {loading && <div className="dashboard-loading">Loading attendance data...</div>}
      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {!loading && recentNotifications.length > 0 && (
        <div className="announcement-marquee" aria-label="Recent announcements">
          <div className="announcement-marquee-track">
            {[...recentNotifications, ...recentNotifications].map((notification, index) => (
              <div key={`${notification._id}-${index}`} className="announcement-pill">
                <span className="announcement-pill-title">{notification.title}</span>
                <span className="announcement-pill-message">{notification.message}</span>
                <span className="announcement-pill-meta">
                  {notification.author?.name || "University"} | {new Date(notification.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel profile-section">
        <div className="profile-container">
          <div className="profile-image-wrapper">
            <img src={studentData.profilePhoto} alt="Student" className="profile-image" />
            <div className="profile-badge">Active</div>
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{studentData.name}</h2>
            <div className="profile-details">
              <div className="detail-item">
                <span className="detail-label">Student ID</span>
                <span className="detail-value">{studentData.studentId}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Course</span>
                <span className="detail-value">{studentData.course}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Department</span>
                <span className="detail-value">{studentData.department}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Semester</span>
                <span className="detail-value">{studentData.semester}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Section</span>
                <span className="detail-value">{studentData.section}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="alerts-section">
          {warnings.map((warning) => (
            <div key={warning.id} className="alert alert-warning">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <h4>Attendance Warning</h4>
                <p>{warning.message}</p>
                <span className="alert-percentage">{warning.percentage}%</span>
              </div>
              <button
                className="alert-close"
                onClick={() => dismissWarning(warning.id)}
                aria-label="Dismiss warning"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="stats-grid-student">
        <div className="stat-card-student blue">
          <div className="stat-icon">📚</div>
          <span>Total Classes</span>
          <h2>{attendanceStats.totalClasses}</h2>
        </div>
        <div className="stat-card-student green">
          <div className="stat-icon">✓</div>
          <span>Classes Attended</span>
          <h2>{attendanceStats.classesAttended}</h2>
        </div>
        <div className="stat-card-student red">
          <div className="stat-icon">✕</div>
          <span>Classes Missed</span>
          <h2>{attendanceStats.classesMissed}</h2>
        </div>
        <div className="stat-card-student orange">
          <div className="stat-icon">📊</div>
          <span>Attendance %</span>
          <h2>{attendanceStats.attendancePercentage}%</h2>
        </div>
      </div>

      <div className="glass-panel subject-section">
        <div className="section-header">
          <h3>Subject-wise Attendance</h3>
          <p className="section-subtitle">Attendance grouped by your enrolled classes</p>
        </div>

        <div className="subjects-list">
          {subjectAttendance.length > 0 ? (
            subjectAttendance.map((subject) => (
              <div
                key={subject.id}
                className="subject-card"
                onClick={() =>
                  setExpandedSubject((prev) => (prev === subject.id ? null : subject.id))
                }
              >
                <div className="subject-header">
                  <div className="subject-info">
                    <h4>{subject.name}</h4>
                    {subject.warning && (
                      <span className="warning-badge">⚠️ Below Target</span>
                    )}
                  </div>
                  <div className="subject-percentage">
                    <span
                      className="percentage-value"
                      style={{ color: getPercentageColor(subject.percentage) }}
                    >
                      {subject.percentage}%
                    </span>
                  </div>
                </div>

                {expandedSubject === subject.id && (
                  <div className="subject-details">
                    <div className="detail-row">
                      <span className="detail-name">Course</span>
                      <span className="detail-val">
                        {subject.course || "Not Assigned"} / {subject.section || "-"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-name">Total Classes</span>
                      <span className="detail-val">{subject.totalClasses}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-name">Present</span>
                      <span className="detail-val present-count">{subject.present}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-name">Absent</span>
                      <span className="detail-val absent-count">{subject.absent}</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${subject.percentage}%`,
                            backgroundColor: getPercentageColor(subject.percentage),
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-data">No subject attendance data available yet.</div>
          )}
        </div>
      </div>

      <div className="glass-panel history-section">
        <div className="section-header">
          <h3>Attendance History</h3>
          <p className="section-subtitle">Your latest attendance records</p>
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            All
          </button>
          <button
            className={`filter-btn ${activeFilter === "Present" ? "active" : ""}`}
            onClick={() => setActiveFilter("Present")}
          >
            Present
          </button>
          <button
            className={`filter-btn ${activeFilter === "Absent" ? "active" : ""}`}
            onClick={() => setActiveFilter("Absent")}
          >
            Absent
          </button>
        </div>

        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Class</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length > 0 ? (
                filteredHistory.map((record, index) => (
                  <tr key={record.id} style={{ animationDelay: `${index * 0.05}s` }}>
                    <td>{new Date(record.date).toLocaleDateString()}</td>
                    <td>{record.subject}</td>
                    <td>
                      {record.course || "General"} {record.section ? `(${record.section})` : ""}
                    </td>
                    <td>
                      <span
                        className="status-badge-table"
                        style={{
                          backgroundColor:
                            (record.status === "Present" ? "#10b981" : "#ef4444") + "20",
                        }}
                      >
                        <span
                          className="status-dot"
                          style={{
                            backgroundColor:
                              record.status === "Present" ? "#10b981" : "#ef4444",
                          }}
                        ></span>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="no-data">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel calendar-section">
        <div className="section-header">
          <h3>Calendar Overview</h3>
          <div className="calendar-header-actions">
            <button
              className="calendar-nav-btn"
              type="button"
              onClick={() =>
                setSelectedCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
            >
              Previous
            </button>
            <span className="calendar-month-label">{formatMonthLabel(selectedCalendarMonth)}</span>
            <button
              className="calendar-nav-btn"
              type="button"
              onClick={() =>
                setSelectedCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
            >
              Next
            </button>
          </div>
        </div>

        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#10b981" }}></div>
            <span>All Present</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#ef4444" }}></div>
            <span>At Least One Absence</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#e5e7eb" }}></div>
            <span>No Class</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#f59e0b" }}></div>
            <span>Holiday</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#8b5cf6" }}></div>
            <span>Exam Week</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: "#06b6d4" }}></div>
            <span>No-Class Day</span>
          </div>
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => (
            <div
              key={day.dayNumber}
              className="calendar-day"
              style={{ backgroundColor: day.color }}
              title={day.label || `Day ${day.dayNumber}`}
            >
              {day.dayNumber}
            </div>
          ))}
        </div>
      </div>

<div className="glass-panel history-section">
        <div className="section-header">
          <h3>Attendance Insights</h3>
          <p className="section-subtitle">Quick analytics for the current semester</p>
        </div>
        <div className="stats-grid-student">
          <div className="stat-card-student blue">
            <div className="stat-icon">🗓️</div>
            <span>This Semester</span>
            <h2>{semesterInsight.totalCount}</h2>
          </div>
          <div className="stat-card-student green">
            <div className="stat-icon">✅</div>
            <span>Present This Semester</span>
            <h2>{semesterInsight.presentCount}</h2>
          </div>
          <div className="stat-card-student orange">
            <div className="stat-icon">📈</div>
            <span>Semester %</span>
            <h2>{semesterInsight.attendancePercentage}%</h2>
          </div>
          <div className="stat-card-student red">
            <div className="stat-icon">🏅</div>
            <span>Best Subject</span>
            <h2>{semesterInsight.strongestSubject}</h2>
          </div>
        </div>
      </div>

      <div className="glass-panel self-service-section">
        <div className="section-header">
          <h3>Self-Service Tools</h3>
          <p className="section-subtitle">Download reports and monitor your semester progress</p>
        </div>
        <div className="self-service-actions">
          <button className="btn-submit self-service-btn" type="button" onClick={downloadAttendanceReport}>
            Download Personal Attendance Report
          </button>
          <div className="self-service-summary">
            <span>Semester</span>
            <strong>{activeSemester || "Not Assigned"}</strong>
          </div>
          <div className="self-service-summary">
            <span>Subjects Tracked</span>
            <strong>{subjectAttendance.length}</strong>
          </div>
        </div>
      </div>

      <div className="glass-panel timetable-section">
        <div className="section-header">
          <h3>My Timetable</h3>
          <p className="section-subtitle">Your recurring classes for the semester</p>
        </div>
        <div className="timetable-grid">
          {timetableEntries.length > 0 ? (
            timetableEntries.map((classItem) => (
              <div key={classItem._id} className="timetable-card">
                <div className="timetable-card-top">
                  <h4>{classItem.subject}</h4>
                  <span>{classItem.course}</span>
                </div>
                <p>{classItem.weekdayLabel}</p>
                <p>{classItem.startTime} - {classItem.endTime}</p>
                <p>{classItem.termLabel}</p>
                <p>Section {classItem.section}{classItem.room ? ` | Room ${classItem.room}` : ""}</p>
              </div>
            ))
          ) : (
            <div className="no-data">No timetable slots assigned yet.</div>
          )}
        </div>
      </div>

      <div className="glass-panel trend-section">
        <div className="section-header">
          <h3>Semester Trend</h3>
          <p className="section-subtitle">Attendance percentage across your semesters</p>
        </div>
        <div className="trend-chart">
          {semesterTrendData.length > 0 ? (
            semesterTrendData.map((item) => (
              <div key={item.semester} className="trend-bar-group">
                <div className="trend-bar-shell">
                  <div
                    className="trend-bar-fill"
                    style={{
                      height: `${Math.max(item.percentage, 6)}%`,
                      backgroundColor: getPercentageColor(item.percentage),
                    }}
                  ></div>
                </div>
                <strong>{item.percentage}%</strong>
                <span>Sem {item.semester}</span>
              </div>
            ))
          ) : (
            <div className="no-data">Not enough attendance history to show a semester trend.</div>
          )}
        </div>
      </div>

      <div className="glass-panel planner-section">
        <div className="section-header">
          <h3>Attendance Prediction</h3>
          <p className="section-subtitle">See how future absences or presents will affect your 75% target</p>
        </div>
        <div className="planner-grid">
          <div className="planner-card overall">
            <h4>Overall Semester Prediction</h4>
            {attendancePlanner.overall.status !== "no-data" && (
              <p>
                If you miss 2 more classes, your attendance will drop to{" "}
                {attendancePlanner.overall.afterTwoMisses}%.
              </p>
            )}
            {attendancePlanner.overall.status === "safe" ? (
              <p>You can miss about {attendancePlanner.overall.canMissMore} more classes and stay above 75%.</p>
            ) : attendancePlanner.overall.status === "below" ? (
              <p>You need {attendancePlanner.overall.classesNeeded} consecutive presents to reach 75%.</p>
            ) : (
              <p>No attendance data available yet for planning.</p>
            )}
          </div>
          {attendancePlanner.subjects.map((subject) => (
            <div key={subject.id} className="planner-card">
              <h4>{subject.name}</h4>
              {subject.prediction && (
                <p>
                  If you miss 2 more {subject.totalClasses === 1 ? "class" : "classes"}, attendance becomes{" "}
                  {subject.prediction.afterTwoMisses}%.
                </p>
              )}
              {subject.planner.status === "safe" ? (
                <p>Can miss {subject.planner.canMissMore} more class(es) and remain above 75%.</p>
              ) : subject.planner.status === "below" ? (
                <p>Needs {subject.planner.classesNeeded} consecutive present class(es) to recover to 75%.</p>
              ) : (
                <p>Not enough data yet for this subject.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel subject-section">
        <div className="section-header">
          <h3>Announcements</h3>
          <p className="section-subtitle">Messages from your university team</p>
        </div>
        <div className="subjects-list" style={{ marginBottom: "1.5rem" }}>
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <div key={notification._id} className="subject-card">
                <div className="subject-header">
                  <div className="subject-info">
                    <h4>{notification.title}</h4>
                    <span className="warning-badge">
                      {notification.author?.name || "University"}
                    </span>
                  </div>
                  <div className="subject-percentage">
                    <span className="percentage-value" style={{ fontSize: "0.95rem" }}>
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="subject-details" style={{ display: "block", marginTop: "1rem", paddingTop: "1rem" }}>
                  <p style={{ margin: 0, color: "var(--text-primary)" }}>{notification.message}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="no-data">No announcements yet.</div>
          )}
        </div>
      </div>

      <div className="glass-panel subject-section">
        <div className="section-header">
          <h3>Enrolled Classes</h3>
          <p className="section-subtitle">Classes currently assigned to you</p>
        </div>
        <div className="subjects-list">
          {enrolledClasses.length > 0 ? (
            enrolledClasses.map((classItem) => (
              <div key={classItem._id} className="subject-card">
                <div className="subject-header">
                  <div className="subject-info">
                    <h4>{classItem.subject}</h4>
                    <span className="warning-badge">
                      {classItem.course} / {classItem.section}
                    </span>
                  </div>
                  <div className="subject-percentage">
                    <span className="percentage-value">{classItem.semester}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-data">No classes have been assigned yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;
