import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/student-dashboard.css";
import { useTheme } from "../context/ThemeContext";
import { attendanceAPI, userAPI, clearAuthToken } from "../utils/apiClient";

function StudentDashboard() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const getCurrentUser = () => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  };

  const [studentData, setStudentData] = useState({
    name: "Rohit Kumar",
    studentId: "STU20240501",
    course: "Bachelor of Technology",
    department: "Computer Science",
    semester: "5th Semester",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Rohit+Kumar&size=150&background=6366f1&color=fff",
  });

  const [loading, setLoading] = useState(false);
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

  const [attendanceStats, setAttendanceStats] = useState(() => {
    const saved = localStorage.getItem("studentAttendanceStats");
    return saved
      ? JSON.parse(saved)
      : {
          totalClasses: 0,
          classesAttended: 0,
          classesMissed: 0,
          attendancePercentage: 0,
        };
  });

  const [subjectAttendance, setSubjectAttendance] = useState(() => {
    const saved = localStorage.getItem("studentSubjectAttendance");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 1,
            name: "Data Structures",
            totalClasses: 20,
            present: 18,
            absent: 2,
            percentage: 90,
            warning: false,
          },
          {
            id: 2,
            name: "DBMS",
            totalClasses: 15,
            present: 11,
            absent: 4,
            percentage: 73,
            warning: true,
          },
          {
            id: 3,
            name: "Web Development",
            totalClasses: 18,
            present: 18,
            absent: 0,
            percentage: 100,
            warning: false,
          },
          {
            id: 4,
            name: "Operating Systems",
            totalClasses: 16,
            present: 14,
            absent: 2,
            percentage: 87.5,
            warning: false,
          },
          {
            id: 5,
            name: "Computer Networks",
            totalClasses: 11,
            present: 11,
            absent: 0,
            percentage: 100,
            warning: false,
          },
        ];
  });

  const [attendanceHistory, setAttendanceHistory] = useState(() => {
    const saved = localStorage.getItem("studentAttendanceHistory");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 1,
            date: "2025-03-10",
            subject: "Data Structures",
            status: "Present",
          },
          {
            id: 2,
            date: "2025-03-10",
            subject: "Web Development",
            status: "Present",
          },
          {
            id: 3,
            date: "2025-03-09",
            subject: "Operating Systems",
            status: "Absent",
          },
          { id: 4, date: "2025-03-09", subject: "DBMS", status: "Present" },
          {
            id: 5,
            date: "2025-03-08",
            subject: "Computer Networks",
            status: "Present",
          },
          {
            id: 6,
            date: "2025-03-08",
            subject: "Data Structures",
            status: "Present",
          },
          {
            id: 7,
            date: "2025-03-07",
            subject: "Web Development",
            status: "Present",
          },
          { id: 8, date: "2025-03-07", subject: "DBMS", status: "Absent" },
        ];
  });

  const [warnings, setWarnings] = useState(() => {
    const saved = localStorage.getItem("studentWarnings");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 1,
            subject: "DBMS",
            message: "Warning: Your attendance in DBMS is below 75%",
            percentage: 73,
          },
        ];
  });

  // Save attendance stats to localStorage
  useEffect(() => {
    localStorage.setItem(
      "studentAttendanceStats",
      JSON.stringify(attendanceStats),
    );
  }, [attendanceStats]);

  // Save subject attendance to localStorage
  useEffect(() => {
    localStorage.setItem(
      "studentSubjectAttendance",
      JSON.stringify(subjectAttendance),
    );
  }, [subjectAttendance]);

  // Save attendance history to localStorage
  useEffect(() => {
    localStorage.setItem(
      "studentAttendanceHistory",
      JSON.stringify(attendanceHistory),
    );
  }, [attendanceHistory]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");

    try {
      const [statsResponse, attendanceResponse] = await Promise.all([
        attendanceAPI.getAttendanceStats(),
        attendanceAPI.getMyAttendance(),
      ]);

      setAttendanceStats({
        totalClasses: statsResponse.totalDays,
        classesAttended: statsResponse.present,
        classesMissed: statsResponse.absent,
        attendancePercentage: Number(statsResponse.attendancePercentage),
      });

      const newHistory = attendanceResponse
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map((entry, index) => ({
          id: entry._id || index,
          date: entry.date,
          subject: "General Attendance",
          status: entry.status === "present" ? "Present" : "Absent",
        }));

      setAttendanceHistory(newHistory);

      setSubjectAttendance((prevSubjectAttendance) => prevSubjectAttendance);

      if (Number(statsResponse.attendancePercentage) < 75) {
        setWarnings([
          {
            id: 1,
            subject: "Overall",
            message: `Your overall attendance is ${statsResponse.attendancePercentage}%. Please improve to stay above 75%`,
            percentage: Number(statsResponse.attendancePercentage),
          },
        ]);
      } else {
        setWarnings([]);
      }
    } catch (err) {
      console.error("Student dashboard load error", err);
      setError(err.message || "Unable to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  const dismissWarning = (id) => {
    setWarnings((prevWarnings) =>
      prevWarnings.filter((warning) => warning.id !== id),
    );
  };

  const handleLogout = () => {
    clearAuthToken();
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleChangePasswordOpen = () => {
    setShowChangePasswordModal(true);
    setShowProfileMenu(false);
    setChangePasswordError("");
    setChangePasswordSuccess("");
  };

  const handleChangePasswordChange = (e) => {
    const { name, value } = e.target;
    setChangePasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
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

    if (
      changePasswordForm.newPassword !== changePasswordForm.confirmNewPassword
    ) {
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

      setTimeout(() => {
        setShowChangePasswordModal(false);
      }, 2000);
    } catch (err) {
      setChangePasswordError(err.message || "Failed to change password");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // Apply theme on mount
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setStudentData((prev) => ({
        ...prev,
        name: user.name || prev.name,
        studentId: user._id ? `STU${user._id.slice(-6)}` : prev.studentId,
        profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          user.name || prev.name,
        )}&size=150&background=6366f1&color=fff`,
      }));
    }

    loadDashboardData();
  }, []);

  // Save warnings to localStorage
  useEffect(() => {
    localStorage.setItem("studentWarnings", JSON.stringify(warnings));
  }, [warnings]);

  const [expandedSubject, setExpandedSubject] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredHistory =
    activeFilter === "all"
      ? attendanceHistory
      : attendanceHistory.filter((record) => record.status === activeFilter);

  const getStatusColor = (status) => {
    return status === "Present" ? "#10b981" : "#ef4444";
  };

  const getPercentageColor = (percentage) => {
    if (percentage >= 90) return "#10b981";
    if (percentage >= 75) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="student-dashboard">
      {/* Top Navigation Bar */}
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
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              title="Profile settings"
            >
              ⚙️ Settings
            </button>
            {showProfileMenu && (
              <div className="profile-menu-dropdown">
                <button
                  className="menu-item"
                  onClick={handleChangePasswordOpen}
                >
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

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowChangePasswordModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button
                className="modal-close"
                onClick={() => setShowChangePasswordModal(false)}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleChangePasswordSubmit}
              className="change-password-form"
            >
              {changePasswordError && (
                <div className="form-error">{changePasswordError}</div>
              )}
              {changePasswordSuccess && (
                <div className="form-success">{changePasswordSuccess}</div>
              )}

              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={changePasswordForm.currentPassword}
                  onChange={handleChangePasswordChange}
                  placeholder="Enter your current password"
                  disabled={changePasswordLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={changePasswordForm.newPassword}
                  onChange={handleChangePasswordChange}
                  placeholder="Enter new password (min 6 characters)"
                  disabled={changePasswordLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmNewPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  value={changePasswordForm.confirmNewPassword}
                  onChange={handleChangePasswordChange}
                  placeholder="Confirm new password"
                  disabled={changePasswordLoading}
                />
              </div>

              <button
                type="submit"
                className="btn-submit"
                disabled={changePasswordLoading}
              >
                {changePasswordLoading ? "Changing..." : "Change Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="dashboard-header">
        <h1>Student Dashboard</h1>
        <p>Welcome back! Here's your attendance overview</p>
      </div>

      {loading && (
        <div className="dashboard-loading">Loading attendance data...</div>
      )}

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {/* Profile Section */}
      <div className="glass-panel profile-section">
        <div className="profile-container">
          <div className="profile-image-wrapper">
            <img
              src={studentData.profilePhoto}
              alt="Student"
              className="profile-image"
            />
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
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Alerts */}
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

      {/* Attendance Summary Cards */}
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

      {/* Subject-wise Attendance */}
      <div className="glass-panel subject-section">
        <div className="section-header">
          <h3>Subject-wise Attendance</h3>
          <p className="section-subtitle">
            Your attendance across all subjects
          </p>
        </div>

        <div className="subjects-list">
          {subjectAttendance.map((subject) => (
            <div
              key={subject.id}
              className="subject-card"
              onClick={() =>
                setExpandedSubject(
                  expandedSubject === subject.id ? null : subject.id,
                )
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
                    <span className="detail-name">Total Classes</span>
                    <span className="detail-val">{subject.totalClasses}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-name">
                      <span className="status-badge present">Present</span>
                    </span>
                    <span className="detail-val present-count">
                      {subject.present}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-name">
                      <span className="status-badge absent">Absent</span>
                    </span>
                    <span className="detail-val absent-count">
                      {subject.absent}
                    </span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${subject.percentage}%`,
                          backgroundColor: getPercentageColor(
                            subject.percentage,
                          ),
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Attendance History */}
      <div className="glass-panel history-section">
        <div className="section-header">
          <h3>Attendance History</h3>
          <p className="section-subtitle">Recent attendance records</p>
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length > 0 ? (
                filteredHistory.map((record, index) => (
                  <tr
                    key={record.id}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <td>{new Date(record.date).toLocaleDateString()}</td>
                    <td>{record.subject}</td>
                    <td>
                      <span
                        className="status-badge-table"
                        style={{
                          backgroundColor: getStatusColor(record.status) + "20",
                        }}
                      >
                        <span
                          className="status-dot"
                          style={{
                            backgroundColor: getStatusColor(record.status),
                          }}
                        ></span>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="no-data">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calendar View */}
      <div className="glass-panel calendar-section">
        <div className="section-header">
          <h3>Calendar Overview</h3>
          <p className="section-subtitle">
            Visual representation of your attendance
          </p>
        </div>

        <div className="calendar-legend">
          <div className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: "#10b981" }}
            ></div>
            <span>Present</span>
          </div>
          <div className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: "#ef4444" }}
            ></div>
            <span>Absent</span>
          </div>
          <div className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: "#e5e7eb" }}
            ></div>
            <span>No Class</span>
          </div>
        </div>

        <div className="calendar-grid">
          {[...Array(28)].map((_, i) => {
            const day = i + 1;
            const isPresent = Math.random() > 0.2;
            const hasClass = Math.random() > 0.15;

            return (
              <div
                key={i}
                className="calendar-day"
                style={{
                  backgroundColor: !hasClass
                    ? "#e5e7eb"
                    : isPresent
                      ? "#10b981"
                      : "#ef4444",
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;
