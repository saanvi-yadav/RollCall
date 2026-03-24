import { useEffect, useMemo, useState } from "react";
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
  userAPI,
} from "../utils/apiClient";

const formatMonthKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatDayKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getPercentageColor = (percentage) => {
  if (percentage >= 90) return "#10b981";
  if (percentage >= 75) return "#f59e0b";
  return "#ef4444";
};

function StudentDashboard() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const currentUser = getCurrentUser();

  const [studentData, setStudentData] = useState({
    name: currentUser?.name || "Student",
    studentId: currentUser?.id ? `STU${currentUser.id.slice(-6)}` : "Not Available",
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

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      setError("");

      try {
        const [statsResponse, attendanceResponse, classesResponse, notificationsResponse] = await Promise.all([
          attendanceAPI.getAttendanceStats(),
          attendanceAPI.getMyAttendance(),
          classAPI.getStudentClasses(),
          notificationAPI.getNotifications(),
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
        setEnrolledClasses(classesResponse);
        setNotifications(notificationsResponse);

        const groupedSubjects = new Map();
        normalizedHistory.forEach((record) => {
          const key = record.classId || record.subject;
          if (!groupedSubjects.has(key)) {
            groupedSubjects.set(key, {
              id: key,
              name: record.subject,
              course: record.course,
              semester: record.semester,
              section: record.section,
              totalClasses: 0,
              present: 0,
              absent: 0,
              percentage: 0,
              warning: false,
            });
          }

          const subject = groupedSubjects.get(key);
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
          studentId: currentUser?.id ? `STU${currentUser.id.slice(-6)}` : "Not Available",
          course: primaryClass?.course || "Not Assigned",
          department: currentUser?.department || primaryClass?.subject || "Not Assigned",
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
  }, [
    currentUser?.department,
    currentUser?.id,
    currentUser?.name,
    currentUser?.section,
    currentUser?.semester,
  ]);

  const filteredHistory =
    activeFilter === "all"
      ? attendanceHistory
      : attendanceHistory.filter((record) => record.status === activeFilter);

  const calendarDays = useMemo(() => {
    const currentDate = new Date();
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

    return Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const dayKey = `${monthKey}-${String(dayNumber).padStart(2, "0")}`;
      const statuses = recordsByDay.get(dayKey) || [];
      const hasClass = statuses.length > 0;
      const allPresent = hasClass && statuses.every((status) => status === "Present");

      return {
        dayNumber,
        color: !hasClass ? "#e5e7eb" : allPresent ? "#10b981" : "#ef4444",
      };
    });
  }, [attendanceHistory]);

  const monthlyInsight = useMemo(() => {
    const monthKey = formatMonthKey(new Date());
    const monthlyRecords = attendanceHistory.filter(
      (record) => formatMonthKey(record.date) === monthKey,
    );
    const presentCount = monthlyRecords.filter((record) => record.status === "Present").length;
    const totalCount = monthlyRecords.length;
    const attendancePercentage =
      totalCount === 0 ? 0 : Number(((presentCount / totalCount) * 100).toFixed(2));
    const strongestSubject = [...subjectAttendance].sort(
      (a, b) => b.percentage - a.percentage,
    )[0];

    return {
      totalCount,
      presentCount,
      attendancePercentage,
      strongestSubject: strongestSubject?.name || "No subject data",
    };
  }, [attendanceHistory, subjectAttendance]);

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
          <div className="profile-menu-wrapper">
            <button
              className="profile-menu-btn"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              title="Profile settings"
            >
              ⚙️ Settings
            </button>
            {showProfileMenu && (
              <div className="profile-menu-dropdown">
                <button className="menu-item" onClick={handleChangePasswordOpen}>
                  🔐 Change Password
                </button>
                <button className="menu-item" onClick={handleLogout}>
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
                <span className="detail-label">Department / Subject</span>
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
          <p className="section-subtitle">Real attendance status for this month</p>
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
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => (
            <div
              key={day.dayNumber}
              className="calendar-day"
              style={{ backgroundColor: day.color }}
            >
              {day.dayNumber}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel history-section">
        <div className="section-header">
          <h3>Attendance Insights</h3>
          <p className="section-subtitle">Quick analytics for the current month</p>
        </div>
        <div className="stats-grid-student">
          <div className="stat-card-student blue">
            <div className="stat-icon">🗓️</div>
            <span>This Month</span>
            <h2>{monthlyInsight.totalCount}</h2>
          </div>
          <div className="stat-card-student green">
            <div className="stat-icon">✅</div>
            <span>Present This Month</span>
            <h2>{monthlyInsight.presentCount}</h2>
          </div>
          <div className="stat-card-student orange">
            <div className="stat-icon">📈</div>
            <span>Monthly %</span>
            <h2>{monthlyInsight.attendancePercentage}%</h2>
          </div>
          <div className="stat-card-student red">
            <div className="stat-icon">🏅</div>
            <span>Best Subject</span>
            <h2>{monthlyInsight.strongestSubject}</h2>
          </div>
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
