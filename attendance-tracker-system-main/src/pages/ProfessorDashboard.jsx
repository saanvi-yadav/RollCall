import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/professor-dashboard.css";
import { useTheme } from "../context/ThemeContext";
import {
  attendanceAPI,
  classAPI,
  clearAuthToken,
  clearCurrentUser,
  courseAPI,
  getCurrentUser,
  notificationAPI,
  userAPI,
} from "../utils/apiClient";

const toDateInputValue = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getPercentageColor = (percentage) => {
  if (percentage >= 90) return "#10b981";
  if (percentage >= 75) return "#f59e0b";
  return "#ef4444";
};

const getAcademicId = (student = {}) =>
  student.academicId || student.username || student.email?.split("@")[0] || "";

const compareAcademicIds = (left = "", right = "") =>
  left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "PR";

const getNotificationFilterLabel = (notification) => {
  const parts = [];

  if (notification.targetClass?.subject) {
    parts.push(`Class: ${notification.targetClass.subject} (${notification.targetClass.section || "-"})`);
  }
  if (notification.targetCourse?.code) {
    parts.push(`Course: ${notification.targetCourse.code}`);
  }
  if (notification.targetSemester) {
    parts.push(`Semester: ${notification.targetSemester}`);
  }
  if (notification.targetSection) {
    parts.push(`Section: ${notification.targetSection}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "All assigned students";
};

function ProfessorDashboard() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const currentUser = getCurrentUser();

  const [professorData, setProfessorData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [professorCourses, setProfessorCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [activeTab, setActiveTab] = useState("mark");
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [viewingRecordStudents, setViewingRecordStudents] = useState([]);
  const [viewingRecordLoading, setViewingRecordLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    targetRoles: ["student"],
    targetCourse: "",
    targetClass: "",
    targetSemester: "",
    targetSection: "",
  });
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState("");
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const profileMenuRef = useRef(null);

  const submissionProgress = students.length
    ? Math.round((Object.keys(attendanceStatus).length / students.length) * 100)
    : 0;
  const filteredAttendanceRecords = attendanceRecords.filter((record) => {
    const classMatches = selectedClass?._id ? record.classId === selectedClass._id : true;
    return classMatches;
  });
  const lowAttendanceCount = reportData
    ? reportData.students.filter((student) => student.attendancePercentage < 75).length
    : 0;
  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) => compareAcademicIds(getAcademicId(a), getAcademicId(b))),
    [students],
  );
  const recentNotifications = useMemo(
    () =>
      [...notifications]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 5),
    [notifications],
  );

  const refreshAttendanceRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const filters = selectedClass?._id ? { classId: selectedClass._id } : {};
      const recordsResponse = await attendanceAPI.getAllAttendanceRecords(filters);
      setAttendanceRecords(recordsResponse);
    } catch (err) {
      setError(err.message || "Failed to load attendance records");
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedClass?._id]);

  const loadReport = useCallback(async (classId) => {
    if (!classId) {
      setReportData(null);
      return;
    }

    setReportLoading(true);
    try {
      const reportResponse = await attendanceAPI.getClassAttendanceReport(classId);
      setReportData(reportResponse);
    } catch (err) {
      setError(err.message || "Failed to load attendance report");
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadProfessorData = async () => {
      setLoading(true);
      try {
        const classesResponse = await classAPI.getProfessorClasses();
        const coursesResponse = await courseAPI.getProfessorCourses();
        const notificationsResponse = await notificationAPI.getNotifications();
        setClasses(classesResponse);
        setProfessorCourses(coursesResponse);
        setNotifications(notificationsResponse);

        const initialClass = classesResponse[0] || null;
        setSelectedClass(initialClass);
        setProfessorData({
          name: currentUser?.name || "Professor",
          professorId:
            currentUser?.username || currentUser?.email?.split("@")[0] || "Not Available",
          department: coursesResponse[0]?.department || initialClass?.course || "Assigned via classes",
          profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || "Professor")}&size=150&background=f59e0b&color=fff`,
        });

        await refreshAttendanceRecords();
        if (initialClass?._id) {
          await loadReport(initialClass._id);
        }
      } catch (err) {
        console.error("Error loading professor data:", err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadProfessorData();
  }, [
    currentUser?.email,
    currentUser?.id,
    currentUser?.name,
    currentUser?.username,
    loadReport,
    refreshAttendanceRecords,
  ]);

  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedClass?._id) {
        setStudents([]);
        setAttendanceStatus({});
        return;
      }

      try {
        const studentsResponse = await classAPI.getClassStudents(selectedClass._id);
        setStudents(studentsResponse);
        if (!(activeTab === "edit" && editingRecord?.classId === selectedClass._id)) {
          const initialStatus = {};
          studentsResponse.forEach((student) => {
            initialStatus[student._id] = "";
          });
          setAttendanceStatus(initialStatus);
        }
        await refreshAttendanceRecords();
        await loadReport(selectedClass._id);
      } catch (err) {
        console.error("Error loading students:", err);
        setError(err.message || "Failed to load students");
      }
    };

    loadStudents();
  }, [activeTab, editingRecord?.classId, loadReport, refreshAttendanceRecords, selectedClass?._id]);

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

  const handleAttendanceChange = (studentId, status) => {
    setAttendanceStatus((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const markAllPresent = () => {
    const nextStatus = {};
    students.forEach((student) => {
      nextStatus[student._id] = "present";
    });
    setAttendanceStatus(nextStatus);
  };

  const markAllAbsent = () => {
    const nextStatus = {};
    students.forEach((student) => {
      nextStatus[student._id] = "absent";
    });
    setAttendanceStatus(nextStatus);
  };

  const handleSubmitAttendance = async () => {
    if (!selectedClass?._id) {
      setError("Please select a class");
      return;
    }

    const filledStatuses = Object.fromEntries(
      Object.entries(attendanceStatus).filter(([, status]) => status),
    );

    if (Object.keys(filledStatuses).length !== students.length) {
      setError("Please mark attendance for every student in the class");
      return;
    }

    try {
      await classAPI.markClassAttendance(selectedClass._id, filledStatuses, selectedDate);
      setAttendanceStatus({});
      setError("");
      await refreshAttendanceRecords();
      await loadReport(selectedClass._id);
      setActiveTab("records");
    } catch (err) {
      setError(err.message || "Failed to submit attendance");
    }
  };

  const loadEditSession = useCallback(async () => {
    if (!selectedClass?._id || !selectedDate) {
      setEditingRecord(null);
      return;
    }

    try {
      const [session, studentsResponse] = await Promise.all([
        attendanceAPI.getClassAttendanceSession(selectedClass._id, selectedDate),
        classAPI.getClassStudents(selectedClass._id),
      ]);

      if (!session?.students?.length) {
        setEditingRecord(null);
        setAttendanceStatus({});
        setError("No attendance session exists for the selected class and date.");
        return;
      }

      const nextStatus = {};
      studentsResponse.forEach((student) => {
        nextStatus[student._id] = "";
      });
      session.students.forEach((student) => {
        nextStatus[student.studentId] = student.status;
      });

      setStudents(studentsResponse);
      setAttendanceStatus(nextStatus);
      setEditingRecord({
        id: session.id || `${selectedClass._id}-${selectedDate}`,
        classId: session.classId || selectedClass._id,
        date: session.date || selectedDate,
        subject: session.subject || selectedClass.subject,
        section: session.section || selectedClass.section,
        course: session.course || selectedClass.course,
        presentCount: session.presentCount || 0,
        totalCount: session.totalCount || 0,
        students: session.students,
      });
      setError("");
    } catch (err) {
      setEditingRecord(null);
      setError(err.message || "Failed to load the attendance session");
    }
  }, [selectedClass, selectedDate]);

  useEffect(() => {
    if (activeTab !== "edit") {
      return;
    }

    loadEditSession();
  }, [activeTab, loadEditSession]);

  const openViewRecord = async (record) => {
    const sessionDate = toDateInputValue(record.date);
    setViewingRecord({ ...record, sessionDate });
    setViewingRecordStudents([]);
    setViewingRecordLoading(true);

    try {
      const session = await attendanceAPI.getClassAttendanceSession(record.classId, sessionDate);
      setViewingRecordStudents(session.students || []);
    } catch (err) {
      setError(err.message || "Failed to load attendance session details");
    } finally {
      setViewingRecordLoading(false);
    }
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord?.classId) {
      setError("Please choose a record to edit");
      return;
    }

    const filledStatuses = Object.fromEntries(
      Object.entries(attendanceStatus).filter(([, status]) => status),
    );

    if (Object.keys(filledStatuses).length !== students.length) {
      setError("Please mark attendance for every student before updating");
      return;
    }

    try {
      await classAPI.updateClassAttendance(editingRecord.classId, filledStatuses, selectedDate);
      setEditingRecord(null);
      setActiveTab("records");
      setError("");
      await refreshAttendanceRecords();
      await loadReport(editingRecord.classId);
    } catch (err) {
      setError(err.message || "Failed to update record");
    }
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

  const handleSendAnnouncement = async () => {
    try {
      await notificationAPI.createNotification(notificationForm);
      setNotificationForm({
        title: "",
        message: "",
        targetRoles: ["student"],
        targetCourse: "",
        targetClass: "",
        targetSemester: "",
        targetSection: "",
      });
      const notificationsResponse = await notificationAPI.getNotifications();
      setNotifications(notificationsResponse);
    } catch (err) {
      setError(err.message || "Failed to send announcement");
    }
  };

  return (
    <div className="professor-dashboard">
      <div className="dashboard-topbar">
        <div className="topbar-left">
          <h1>📚 Professor Portal</h1>
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
              className={`account-trigger professor ${showProfileMenu ? "open" : ""}`}
              onClick={() => setShowProfileMenu((prev) => !prev)}
              title="Open account menu"
              type="button"
            >
              <div className="account-trigger-avatar">
                <img
                  src={professorData?.profilePhoto}
                  alt={professorData?.name || "Professor"}
                  className="account-trigger-image"
                />
              </div>
              <div className="account-trigger-copy">
                <span className="account-trigger-name">{professorData?.name || "Professor"}</span>
                <span className="account-trigger-role">Professor</span>
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
                  <div className="profile-menu-avatar professor">{getInitials(professorData?.name || "Professor")}</div>
                  <div className="profile-menu-summary-copy">
                    <strong>{professorData?.name || "Professor"}</strong>
                    <span>{currentUser?.email || "Professor account"}</span>
                  </div>
                </div>
                <button className="menu-item" onClick={toggleTheme} type="button">
                  <span>Appearance</span>
                  <span>{isDark ? "Light" : "Dark"}</span>
                </button>
                <button className="menu-item" onClick={handleChangePasswordOpen}>
                  Change Password
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
        <div className="modal-overlay" onClick={() => setShowChangePasswordModal(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button className="modal-close" onClick={() => setShowChangePasswordModal(false)}>
                X
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="change-password-form">
              {changePasswordError && <div className="form-error">{changePasswordError}</div>}
              {changePasswordSuccess && (
                <div className="form-success">{changePasswordSuccess}</div>
              )}

              <div className="form-group">
                <label htmlFor="profCurrentPassword">Current Password</label>
                <input
                  id="profCurrentPassword"
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
                <label htmlFor="profNewPassword">New Password</label>
                <input
                  id="profNewPassword"
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
                <label htmlFor="profConfirmPassword">Confirm New Password</label>
                <input
                  id="profConfirmPassword"
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

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading professor dashboard...</p>
        </div>
      ) : !professorData ? (
        <div className="error-container">
          <p>Unable to load professor data</p>
        </div>
      ) : (
        <>
          {recentNotifications.length > 0 && (
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

          <div className="dashboard-header">
            <h1>Professor Dashboard</h1>
            <p>Manage classes, attendance sessions, and reports with live data.</p>
          </div>

          <div className="glass-panel profile-section">
            <div className="profile-container">
              <div className="profile-image-wrapper">
                <img
                  src={professorData.profilePhoto}
                  alt="Professor"
                  className="profile-image"
                />
                <div className="profile-badge">Online</div>
              </div>
              <div className="profile-info">
                <h2 className="profile-name">{professorData.name}</h2>
                <div className="profile-details">
                  <div className="detail-item">
                    <span className="detail-label">Professor ID</span>
                    <span className="detail-value">{professorData.professorId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Department</span>
                    <span className="detail-value">{professorData.department}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Classes</span>
                    <span className="detail-value">{classes.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel report-section">
            <div className="section-header">
              <h3>Assigned Courses</h3>
              <p className="section-subtitle">Your course load and nearest scheduled classes</p>
            </div>

            <div className="report-summary">
              <div className="summary-card">
                <h4>Assigned Courses</h4>
                <p className="summary-value">{professorCourses.length}</p>
                <p className="summary-students">Across your department load</p>
              </div>
              <div className="summary-card">
                <h4>Scheduled Classes</h4>
                <p className="summary-value">{classes.length}</p>
                <p className="summary-students">Available for attendance</p>
              </div>
              <div className="summary-card">
                <h4>Next Class</h4>
                <p className="summary-value">
                  {classes[0] ? new Date(classes[0].scheduleDate).toLocaleDateString() : "-"}
                </p>
                <p className="summary-students">
                  {classes[0]
                    ? `${classes[0].subject} ${classes[0].startTime}`
                    : "No schedule yet"}
                </p>
              </div>
            </div>

            <div className="report-table-wrapper" style={{ marginTop: "1.5rem" }}>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Code</th>
                    <th>Semester</th>
                    <th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {professorCourses.length > 0 ? (
                    professorCourses.map((course) => (
                      <tr key={course._id}>
                        <td>{course.name}</td>
                        <td>{course.code}</td>
                        <td>{course.semester}</td>
                        <td>{course.department || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="no-data">
                        No courses assigned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="report-table-wrapper" style={{ marginTop: "1.5rem" }}>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Upcoming Class</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Section</th>
                    <th>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.length > 0 ? (
                    classes.map((classItem) => (
                      <tr key={classItem._id}>
                        <td>{classItem.subject}</td>
                        <td>{new Date(classItem.scheduleDate).toLocaleDateString()}</td>
                        <td>
                          {classItem.startTime} - {classItem.endTime}
                        </td>
                        <td>{classItem.section}</td>
                        <td>{classItem.room || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="no-data">
                        No scheduled classes yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel report-section">
            <div className="section-header">
              <h3>Announcements</h3>
              <p className="section-subtitle">Share quick updates with students</p>
            </div>

            <div className="form-group-container" style={{ marginBottom: "1.5rem" }}>
              <div className="form-group">
                <label>Title</label>
                <input
                  value={notificationForm.title}
                  onChange={(event) =>
                    setNotificationForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Message</label>
                <input
                  value={notificationForm.message}
                  onChange={(event) =>
                    setNotificationForm((prev) => ({ ...prev, message: event.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label>Target Class</label>
                <select
                  value={notificationForm.targetClass}
                  onChange={(event) =>
                    setNotificationForm((prev) => ({
                      ...prev,
                      targetClass: event.target.value,
                      targetCourse: event.target.value ? "" : prev.targetCourse,
                    }))
                  }
                >
                  <option value="">All assigned classes</option>
                  {classes.map((classItem) => (
                    <option key={classItem._id} value={classItem._id}>
                      {classItem.subject} / Sem {classItem.semester} / Sec {classItem.section}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Target Course</label>
                <select
                  value={notificationForm.targetCourse}
                  onChange={(event) =>
                    setNotificationForm((prev) => ({
                      ...prev,
                      targetCourse: event.target.value,
                      targetClass: event.target.value ? "" : prev.targetClass,
                    }))
                  }
                >
                  <option value="">All assigned courses</option>
                  {professorCourses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.name} ({course.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Target Semester</label>
                <input
                  value={notificationForm.targetSemester}
                  onChange={(event) =>
                    setNotificationForm((prev) => ({ ...prev, targetSemester: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label>Target Section</label>
                <input
                  value={notificationForm.targetSection}
                  onChange={(event) =>
                    setNotificationForm((prev) => ({
                      ...prev,
                      targetSection: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="edit-actions" style={{ justifyContent: "flex-start", marginBottom: "1.5rem" }}>
              <button className="edit-submit-btn" onClick={handleSendAnnouncement}>
                Send Message
              </button>
            </div>

            <div className="report-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Targeting</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <tr key={notification._id}>
                        <td>{notification.title}</td>
                        <td>{notification.message}</td>
                        <td>{getNotificationFilterLabel(notification)}</td>
                        <td>{new Date(notification.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="no-data">No announcements yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === "mark" ? "active" : ""}`}
              onClick={() => setActiveTab("mark")}
            >
              <span className="tab-icon">📝</span> Mark Attendance
            </button>
            <button
              className={`nav-tab ${activeTab === "records" ? "active" : ""}`}
              onClick={() => setActiveTab("records")}
            >
              <span className="tab-icon">📋</span> View Records
            </button>
            <button
              className={`nav-tab ${activeTab === "report" ? "active" : ""}`}
              onClick={() => setActiveTab("report")}
            >
              <span className="tab-icon">📊</span> Reports
            </button>
            <button
              className={`nav-tab ${activeTab === "edit" ? "active" : ""}`}
              onClick={() => setActiveTab("edit")}
            >
              <span className="tab-icon">✏️</span> Edit Attendance
            </button>
          </div>

          <div className="glass-panel class-selection-section">
            <div className="section-header">
              <h3>Class / Course Selection</h3>
              <p className="section-subtitle">Choose the class and date you want to work with</p>
            </div>

            <div className="selection-grid">
              <div className="selection-form-group">
                <label className="form-label">Class</label>
                <select
                  className="form-select"
                  value={selectedClass?._id || ""}
                  onChange={(event) =>
                    setSelectedClass(
                      classes.find((classItem) => classItem._id === event.target.value) || null,
                    )
                  }
                >
                  <option value="">Select a class</option>
                  {classes.map((classItem) => (
                    <option key={classItem._id} value={classItem._id}>
                      {classItem.subject} - {classItem.course} ({classItem.section})
                    </option>
                  ))}
                </select>
              </div>

              <div className="selection-form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-select"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
            </div>

            {selectedClass && (
              <div className="class-info">
                <div className="info-item">
                  <span className="info-label">Subject:</span>
                  <span className="info-value">{selectedClass.subject}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Course:</span>
                  <span className="info-value">{selectedClass.course}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Section:</span>
                  <span className="info-value">{selectedClass.section}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Semester:</span>
                  <span className="info-value">{selectedClass.semester}</span>
                </div>
              </div>
            )}
          </div>

          {activeTab === "mark" && (
            <div className="tab-content">
              <div className="glass-panel attendance-section">
                <div className="section-header">
                  <h3>Mark Attendance</h3>
                  <p className="section-subtitle">Select present or absent for each student</p>
                </div>

                <div className="action-buttons">
                  <button className="action-btn green" onClick={markAllPresent}>
                    ✓ Mark All Present
                  </button>
                  <button className="action-btn red" onClick={markAllAbsent}>
                    ✕ Mark All Absent
                  </button>
                  <button className="action-btn reset" onClick={() => setAttendanceStatus({})}>
                    🔄 Clear Selection
                  </button>
                </div>

                <div className="records-table-wrapper">
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Student Name</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStudents.map((student, index) => (
                        <tr key={student._id} style={{ animationDelay: `${index * 0.05}s` }}>
                          <td>{getAcademicId(student)}</td>
                          <td>
                            <div className="student-name">{student.name}</div>
                            <div className="student-rollno">{student.email}</div>
                          </td>
                          <td>
                            <div className="attendance-buttons">
                              <button
                                className={`attendance-btn present ${
                                  attendanceStatus[student._id] === "present" ? "selected" : ""
                                }`}
                                onClick={() => handleAttendanceChange(student._id, "present")}
                              >
                                ✓ Present
                              </button>
                              <button
                                className={`attendance-btn absent ${
                                  attendanceStatus[student._id] === "absent" ? "selected" : ""
                                }`}
                                onClick={() => handleAttendanceChange(student._id, "absent")}
                              >
                                ✕ Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="submit-section">
                  <div className="submission-stats">
                    <span className="stat-item">
                      Total Students: <strong>{students.length}</strong>
                    </span>
                    <span className="stat-item">
                      Marked:{" "}
                      <strong>
                        {Object.values(attendanceStatus).filter(Boolean).length}
                      </strong>
                    </span>
                    <span className="stat-item percentage">
                      Progress: <strong>{submissionProgress}%</strong>
                    </span>
                  </div>
                  <button className="submit-btn" onClick={handleSubmitAttendance}>
                    ✓ Submit Attendance
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "records" && (
            <div className="tab-content">
              <div className="glass-panel records-section">
                <div className="section-header">
                  <h3>Attendance Records</h3>
                  <p className="section-subtitle">Class sessions you have already marked</p>
                </div>

                {recordsLoading ? (
                  <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading attendance records...</p>
                  </div>
                ) : (
                  <div className="records-table-wrapper">
                    <table className="records-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Subject</th>
                          <th>Section</th>
                          <th>Present / Total</th>
                          <th>Percentage</th>
                          <th>View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendanceRecords.length > 0 ? (
                          filteredAttendanceRecords.map((record, index) => (
                            <tr key={record.id} style={{ animationDelay: `${index * 0.05}s` }}>
                              <td>{new Date(record.date).toLocaleDateString()}</td>
                              <td>{record.subject}</td>
                              <td>{record.section}</td>
                              <td>
                                <span className="count-badge">
                                  {record.presentCount}/{record.totalCount}
                                </span>
                              </td>
                              <td>
                                <span
                                  className="percentage-badge"
                                  style={{
                                    backgroundColor:
                                      getPercentageColor(record.percentage) + "20",
                                    color: getPercentageColor(record.percentage),
                                  }}
                                >
                                  {record.percentage}%
                                </span>
                              </td>
<td>
                                <button
                                  className="action-icon-btn view"
                                  title="View Details"
                                  type="button"
                                  onClick={() => openViewRecord(record)}
                                >
                                  👁️
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="no-data">
                              No attendance sessions found for the selected class/date.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "report" && (
            <div className="tab-content">
              <div className="glass-panel report-section">
                <div className="section-header">
                  <h3>Attendance Report</h3>
                  <p className="section-subtitle">Student-wise statistics for the selected class</p>
                </div>

                {reportLoading ? (
                  <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading report...</p>
                  </div>
                ) : reportData ? (
                  <>
                    <div className="report-table-wrapper">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>Student Name</th>
                            <th>Email</th>
                            <th>Total Classes</th>
                            <th>Present</th>
                            <th>Absent</th>
                            <th>Attendance %</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.students.map((student, index) => (
                            <tr
                              key={student.studentId}
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                              <td className="student-name-report">{student.name}</td>
                              <td>{student.email}</td>
                              <td>{student.totalClasses}</td>
                              <td className="present-count">{student.present}</td>
                              <td className="absent-count">{student.absent}</td>
                              <td>
                                <span
                                  className="percentage-badge-report"
                                  style={{
                                    backgroundColor:
                                      getPercentageColor(student.attendancePercentage) + "20",
                                    color: getPercentageColor(student.attendancePercentage),
                                  }}
                                >
                                  {student.attendancePercentage}%
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${
                                    student.attendancePercentage >= 75 ? "good" : "warning"
                                  }`}
                                >
                                  {student.attendancePercentage >= 75 ? "✓ Good" : "⚠️ Low"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="report-summary">
                      <div className="summary-card">
                        <h4>Highest Attendance</h4>
                        <p className="summary-value">
                          {reportData.summary.highestAttendance}%
                        </p>
                        <p className="summary-students">{reportData.subject}</p>
                      </div>
                      <div className="summary-card">
                        <h4>Average Attendance</h4>
                        <p className="summary-value">
                          {reportData.summary.averageAttendance}%
                        </p>
                        <p className="summary-students">Across All Students</p>
                      </div>
                      <div className="summary-card">
                        <h4>Lowest Attendance</h4>
                        <p className="summary-value">
                          {reportData.summary.lowestAttendance}%
                        </p>
                        <p className="summary-students">Needs Attention</p>
                      </div>
                      <div className="summary-card">
                        <h4>Total Sessions</h4>
                        <p className="summary-value">{reportData.totalSessions}</p>
                        <p className="summary-students">Recorded This Class</p>
                      </div>
                      <div className="summary-card">
                        <h4>Low Attendance</h4>
                        <p className="summary-value">{lowAttendanceCount}</p>
                        <p className="summary-students">Students below 75%</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="no-selection">
                    <p className="empty-state-icon">📊</p>
                    <p className="empty-state-text">Select a class to view its report.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "edit" && (
            <div className="tab-content">
              <div className="glass-panel edit-section">
                <div className="section-header">
                  <h3>Edit Attendance Record</h3>
                  <p className="section-subtitle">
                    Correct an existing attendance session for the selected date
                  </p>
                </div>

                {editingRecord ? (
                  <div className="edit-form">
                    <div className="edit-info">
                      <div className="edit-info-item">
                        <span className="edit-label">Date:</span>
                        <span className="edit-value">
                          {new Date(editingRecord.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="edit-info-item">
                        <span className="edit-label">Subject:</span>
                        <span className="edit-value">{editingRecord.subject}</span>
                      </div>
                      <div className="edit-info-item">
                        <span className="edit-label">Section:</span>
                        <span className="edit-value">{editingRecord.section}</span>
                      </div>
                    </div>

                    <div className="edit-student-list">
                      <h4>Update Student Attendance</h4>
                      <div className="records-table-wrapper">
                        <table className="records-table">
                          <thead>
                            <tr>
                              <th>Student ID</th>
                              <th>Student Name</th>
                              <th>Attendance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedStudents.map((student, index) => (
                              <tr key={student._id} style={{ animationDelay: `${index * 0.05}s` }}>
                                <td>{getAcademicId(student)}</td>
                                <td>
                                  <span className="edit-student-name">{student.name}</span>
                                  <br />
                                  <span className="edit-student-roll">{student.email}</span>
                                </td>
                                <td>
                                  <div className="edit-attendance-buttons">
                                    <button
                                      className={`edit-btn present ${
                                        attendanceStatus[student._id] === "present" ? "selected" : ""
                                      }`}
                                      onClick={() => handleAttendanceChange(student._id, "present")}
                                    >
                                      ✓ Present
                                    </button>
                                    <button
                                      className={`edit-btn absent ${
                                        attendanceStatus[student._id] === "absent" ? "selected" : ""
                                      }`}
                                      onClick={() => handleAttendanceChange(student._id, "absent")}
                                    >
                                      ✕ Absent
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="edit-actions">
                      <button className="edit-submit-btn" onClick={handleUpdateRecord}>
                        ✓ Update Record
                      </button>
                      <button
                        className="edit-cancel-btn"
                        onClick={() => {
                          setEditingRecord(null);
                          setActiveTab("records");
                        }}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="no-selection">
                    <p className="empty-state-icon">📋</p>
                    <p className="empty-state-text">
                      Choose a class and date above to load an attendance session for editing.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {viewingRecord && (
        <div className="modal-overlay" onClick={() => setViewingRecord(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Attendance Session Details</h2>
              <button className="modal-close" onClick={() => setViewingRecord(null)}>
                X
              </button>
            </div>

            <div className="edit-info" style={{ marginBottom: "1.5rem" }}>
              <div className="edit-info-item">
                <span className="edit-label">Date:</span>
                <span className="edit-value">{new Date(viewingRecord.date).toLocaleDateString()}</span>
              </div>
              <div className="edit-info-item">
                <span className="edit-label">Subject:</span>
                <span className="edit-value">{viewingRecord.subject}</span>
              </div>
              <div className="edit-info-item">
                <span className="edit-label">Section:</span>
                <span className="edit-value">{viewingRecord.section}</span>
              </div>
              <div className="edit-info-item">
                <span className="edit-label">Attendance:</span>
                <span className="edit-value">
                  {viewingRecord.presentCount}/{viewingRecord.totalCount}
                </span>
              </div>
            </div>

            {viewingRecordLoading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading session details...</p>
              </div>
            ) : (
              <div className="records-table-wrapper">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingRecordStudents.length > 0 ? (
                      viewingRecordStudents.map((student) => (
                        <tr key={student.studentId}>
                          <td>{student.name}</td>
                          <td>{student.email || "-"}</td>
                          <td>
                            <span
                              className="percentage-badge"
                              style={{
                                backgroundColor:
                                  student.status === "present" ? "#10b98120" : "#ef444420",
                                color: student.status === "present" ? "#10b981" : "#ef4444",
                              }}
                            >
                              {student.status === "present" ? "Present" : "Absent"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="no-data">
                          No student records found for this session.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfessorDashboard;
