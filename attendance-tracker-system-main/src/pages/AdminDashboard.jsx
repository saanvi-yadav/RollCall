import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/admin-dashboard.css";
import { useTheme } from "../context/ThemeContext";
import {
  adminAPI,
  attendanceAPI,
  classAPI,
  clearAuthToken,
  clearCurrentUser,
  courseAPI,
  getCurrentUser,
  notificationAPI,
  settingsAPI,
} from "../utils/apiClient";

const emptyUserForm = {
  name: "",
  email: "",
  password: "",
  department: "",
  semester: "",
  section: "",
};
const emptyAcademicItemForm = {
  department: "",
  semester: "",
  section: "",
};
const emptyCourseForm = { name: "", code: "", semester: "", department: "", description: "", professor: "" };
const emptyClassForm = {
  subject: "",
  course: "",
  semester: "",
  section: "",
  courseRef: "",
  professor: "",
  students: [],
  scheduleDate: "",
  startTime: "",
  endTime: "",
  room: "",
};

const formatDateLabel = (dateValue) =>
  dateValue ? new Date(dateValue).toLocaleDateString() : "Not scheduled";

const normalizeValue = (value) => (value ? String(value).trim() : "");
const normalizeSection = (value) => normalizeValue(value).toUpperCase();
const toDateInputValue = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const getStudentAcademicId = (student = {}) =>
  student.academicId || student.username || student.email?.split("@")[0] || "";

const getNotificationTargetSummary = (notification) => {
  const details = [];

  if (notification.targetCourse?.code) {
    details.push(`Course: ${notification.targetCourse.code}`);
  }
  if (notification.targetClass?.subject) {
    details.push(`Class: ${notification.targetClass.subject} (${notification.targetClass.section || "-"})`);
  }
  if (notification.targetSemester) {
    details.push(`Semester: ${notification.targetSemester}`);
  }
  if (notification.targetSection) {
    details.push(`Section: ${notification.targetSection}`);
  }

  return details.length > 0 ? details.join(" | ") : "All matching users";
};

function AdminDashboard() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState("students");
  const [students, setStudents] = useState([]);
  const [professors, setProfessors] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicConfig, setAcademicConfig] = useState({
    departments: [],
    semesters: [],
    sections: [],
  });
  const [statsData, setStatsData] = useState({
    totalStudents: 0,
    totalProfessors: 0,
    totalCourses: 0,
    totalClasses: 0,
    averageAttendance: 0,
  });
  const [attendanceRecords, setAttendanceRecords] = useState([]);
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
  const [attendanceFilters, setAttendanceFilters] = useState({
    studentId: "",
    course: "",
    date: "",
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [academicItemForm, setAcademicItemForm] = useState(emptyAcademicItemForm);
  const [attendanceEditRecord, setAttendanceEditRecord] = useState(null);
  const [attendanceEditStudents, setAttendanceEditStudents] = useState([]);
  const [attendanceEditStatus, setAttendanceEditStatus] = useState({});
  const [attendanceEditLoading, setAttendanceEditLoading] = useState(false);
  const [attendanceEditSaving, setAttendanceEditSaving] = useState(false);

  const adminData = {
    name: currentUser?.name || "Admin User",
    adminId: "ADM67",
    email: currentUser?.email || "admin@attendance.com",
    role: "System Admin",
    profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || "Admin User")}&size=150&background=4f46e5&color=fff`,
  };

  const stats = [
    { label: "Total Students", value: statsData.totalStudents, color: "blue", icon: "👥" },
    { label: "Total Professors", value: statsData.totalProfessors, color: "orange", icon: "👨‍🏫" },
    { label: "Total Courses", value: statsData.totalCourses, color: "green", icon: "📚" },
    { label: "Total Classes", value: statsData.totalClasses, color: "purple", icon: "🏫" },
    { label: "Avg Attendance", value: `${statsData.averageAttendance}%`, color: "green", icon: "📊" },
  ];

  const professorOptions = useMemo(
    () => professors.map((professor) => ({
      value: professor._id,
      label: `${professor.name} (${professor.email})`,
    })),
    [professors],
  );

  const studentOptions = useMemo(
    () => students.map((student) => ({
      value: student._id,
      label: `${student.name} (${student.email})`,
      semester: student.semester || "",
      section: student.section || "",
      department: student.department || "",
    })),
    [students],
  );

  const departmentOptions = useMemo(
    () => academicConfig.departments || [],
    [academicConfig.departments],
  );

  const semesterOptions = useMemo(
    () => academicConfig.semesters || [],
    [academicConfig.semesters],
  );

  const sectionOptions = useMemo(
    () => academicConfig.sections || [],
    [academicConfig.sections],
  );

  const filteredStudentOptions = useMemo(() => {
    const semesterFilter = normalizeValue(formData.semester);
    const sectionFilter = normalizeSection(formData.section);

    return studentOptions.filter((student) => {
      const semesterMatches = !semesterFilter || normalizeValue(student.semester) === semesterFilter;
      const sectionMatches = !sectionFilter || normalizeSection(student.section) === sectionFilter;
      return semesterMatches && sectionMatches;
    });
  }, [formData.section, formData.semester, studentOptions]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [studentsResponse, professorsResponse, statsResponse, coursesResponse, classesResponse, academicConfigResponse] =
        await Promise.all([
          adminAPI.getAllStudents(),
          adminAPI.getAllProfessors(),
          adminAPI.getDashboardStats(),
          courseAPI.getAllCourses(),
          classAPI.getAllClasses(),
          settingsAPI.getAcademicConfig(),
        ]);
      setStudents(studentsResponse);
      setProfessors(professorsResponse);
      setStatsData(statsResponse);
      setCourses(coursesResponse);
      setClasses(classesResponse);
      setAcademicConfig({
        departments: academicConfigResponse.departments || [],
        semesters: academicConfigResponse.semesters || [],
        sections: academicConfigResponse.sections || [],
      });
      const attendanceResponse = await attendanceAPI.getAllAttendanceRecords();
      const notificationsResponse = await notificationAPI.getNotifications();
      setAttendanceRecords(attendanceResponse);
      setNotifications(notificationsResponse);
      setError("");
    } catch (err) {
      console.error("Admin dashboard load error:", err);
      setError(err.message || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceRecords = async (filters = attendanceFilters) => {
    try {
      const recordsResponse = await attendanceAPI.getAllAttendanceRecords(filters);
      setAttendanceRecords(recordsResponse);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load attendance records");
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (modalType !== "class") {
      return;
    }

    const semesterFilter = normalizeValue(formData.semester);
    const sectionFilter = normalizeSection(formData.section);

    if (!semesterFilter && !sectionFilter) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      students: (prev.students || []).filter((studentId) => {
        const student = students.find((item) => item._id === studentId);
        if (!student) {
          return false;
        }

        const semesterMatches =
          !semesterFilter || normalizeValue(student.semester) === semesterFilter;
        const sectionMatches =
          !sectionFilter || normalizeSection(student.section) === sectionFilter;

        return semesterMatches && sectionMatches;
      }),
    }));
  }, [formData.section, formData.semester, modalType, students]);

  const handleLogout = () => {
    clearAuthToken();
    clearCurrentUser();
    navigate("/login");
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType(null);
    setEditingId(null);
    setFormData({});
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingId(item?._id || null);
    if (!item) {
      setFormData(
        type === "course" ? emptyCourseForm : type === "class" ? emptyClassForm : emptyUserForm,
      );
    } else if (type === "course") {
      setFormData({
        name: item.name || "",
        code: item.code || "",
        semester: item.semester || "",
        department: item.department || "",
        description: item.description || "",
        professor: item.professor?._id || item.professor || "",
      });
    } else if (type === "class") {
      setFormData({
        subject: item.subject || "",
        course: item.course || "",
        semester: item.semester || "",
        section: item.section || "",
        courseRef: item.courseRef?._id || "",
        professor: item.professor?._id || item.professor || "",
        students: item.students?.map((student) => student._id) || [],
        scheduleDate: item.scheduleDate?.slice(0, 10) || "",
        startTime: item.startTime || "",
        endTime: item.endTime || "",
        room: item.room || "",
      });
    } else {
      setFormData({
        name: item.name || "",
        email: item.email || "",
        password: "",
        department: item.department || "",
        semester: item.semester || "",
        section: item.section || "",
      });
    }
    setShowModal(true);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "section" ? value.toUpperCase() : value,
    }));
  };

  const handleAttendanceFilterChange = (event) => {
    const { name, value } = event.target;
    setAttendanceFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleAcademicItemChange = (event) => {
    const { name, value } = event.target;
    setAcademicItemForm((prev) => ({
      ...prev,
      [name]: name === "section" ? value.toUpperCase() : value,
    }));
  };

  const toggleTargetRole = (role) => {
    setNotificationForm((prev) => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter((item) => item !== role)
        : [...prev.targetRoles, role],
    }));
  };

  const handleNotificationInputChange = (name, value) => {
    setNotificationForm((prev) => ({
      ...prev,
      [name]: name === "targetSection" ? value.toUpperCase() : value,
      ...(name === "targetCourse" && value ? { targetClass: "" } : {}),
      ...(name === "targetClass" && value ? { targetCourse: "" } : {}),
    }));
  };

  const handleClassCourseChange = (event) => {
    const courseId = event.target.value;
    const course = courses.find((item) => item._id === courseId);
    setFormData((prev) => ({
      ...prev,
      courseRef: courseId,
      subject: course?.name || prev.subject,
      course: course?.code || prev.course,
      semester: course?.semester ? String(course.semester) : prev.semester,
      professor: course?.professor?._id || prev.professor,
      students:
        course?.semester && prev.section
          ? students
              .filter(
                (student) =>
                  normalizeValue(student.semester) === String(course.semester) &&
                  normalizeSection(student.section) === normalizeSection(prev.section),
              )
              .map((student) => student._id)
          : prev.students,
    }));
  };

  const handleStudentSelection = (studentId) => {
    setFormData((prev) => {
      const selected = prev.students || [];
      return {
        ...prev,
        students: selected.includes(studentId)
          ? selected.filter((id) => id !== studentId)
          : [...selected, studentId],
      };
    });
  };

  const handleSelectFilteredStudents = () => {
    setFormData((prev) => ({
      ...prev,
      students: [...new Set(filteredStudentOptions.map((student) => student.value))],
    }));
  };

  const handleClearFilteredStudents = () => {
    const filteredIds = new Set(filteredStudentOptions.map((student) => student.value));
    setFormData((prev) => ({
      ...prev,
      students: (prev.students || []).filter((studentId) => !filteredIds.has(studentId)),
    }));
  };

  const handleUpdateAcademicConfig = async (nextConfig) => {
    try {
      const response = await settingsAPI.updateAcademicConfig(nextConfig);
      setAcademicConfig({
        departments: response.departments || [],
        semesters: response.semesters || [],
        sections: response.sections || [],
      });
      setAcademicItemForm(emptyAcademicItemForm);
      setSuccessMessage("Academic configuration updated successfully");
    } catch (err) {
      setError(err.message || "Failed to update academic configuration");
    }
  };

  const handleAddAcademicItem = async (type) => {
    const value =
      type === "section"
        ? normalizeSection(academicItemForm.section)
        : normalizeValue(academicItemForm[type]);

    if (!value) {
      setError(`Please enter a ${type}`);
      return;
    }

    await handleUpdateAcademicConfig({
      departments:
        type === "department"
          ? [...departmentOptions, value]
          : departmentOptions,
      semesters:
        type === "semester"
          ? [...semesterOptions, value]
          : semesterOptions,
      sections:
        type === "section"
          ? [...sectionOptions, value]
          : sectionOptions,
    });
  };

  const handleRemoveAcademicItem = async (type, value) => {
    await handleUpdateAcademicConfig({
      departments:
        type === "department"
          ? departmentOptions.filter((item) => item !== value)
          : departmentOptions,
      semesters:
        type === "semester"
          ? semesterOptions.filter((item) => item !== value)
          : semesterOptions,
      sections:
        type === "section"
          ? sectionOptions.filter((item) => item !== value)
          : sectionOptions,
    });
  };

  const handleSaveUser = async (role) => {
    try {
      if (editingId) {
        await adminAPI.updateUser(editingId, formData);
        setSuccessMessage(`${role === "student" ? "Student" : "Professor"} updated successfully`);
      } else {
        const response = await adminAPI.createUser({ ...formData, role });
        setSuccessMessage(response.message || `${role === "student" ? "Student" : "Professor"} created successfully`);
      }
      closeModal();
      await loadDashboardData();
    } catch (err) {
      setError(err.message || `Failed to save ${role}`);
    }
  };

  const handleSaveCourse = async () => {
    try {
      const payload = { ...formData, semester: Number(formData.semester) };
      if (editingId) {
        await courseAPI.updateCourse(editingId, payload);
        setSuccessMessage("Course updated successfully");
      } else {
        await courseAPI.createCourse(payload);
        setSuccessMessage("Course created successfully");
      }
      closeModal();
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Failed to save course");
    }
  };

  const handleSaveClass = async () => {
    try {
      if (editingId) {
        await classAPI.updateClass(editingId, formData);
        setSuccessMessage("Class schedule updated successfully");
      } else {
        await classAPI.createClass(formData);
        setSuccessMessage("Class schedule created successfully");
      }
      closeModal();
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Failed to save class schedule");
    }
  };

  const handleDeleteUser = async (id, role) => {
    if (!confirm(`Are you sure you want to delete this ${role}?`)) return;
    try {
      await adminAPI.deleteUser(id);
      setSuccessMessage(`${role === "student" ? "Student" : "Professor"} deleted successfully`);
      await loadDashboardData();
    } catch (err) {
      setError(err.message || `Failed to delete ${role}`);
    }
  };

  const handleDeleteCourse = async (id) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    try {
      await courseAPI.deleteCourse(id);
      setSuccessMessage("Course deleted successfully");
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Failed to delete course");
    }
  };

  const handleDeleteClass = async (id) => {
    if (!confirm("Are you sure you want to delete this class schedule?")) return;
    try {
      await classAPI.deleteClass(id);
      setSuccessMessage("Class schedule deleted successfully");
      await loadDashboardData();
    } catch (err) {
      setError(err.message || "Failed to delete class schedule");
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
      setSuccessMessage("Announcement sent successfully");
      const notificationsResponse = await notificationAPI.getNotifications();
      setNotifications(notificationsResponse);
    } catch (err) {
      setError(err.message || "Failed to send announcement");
    }
  };

  const exportAttendanceCsv = () => {
    const headers = ["Date", "Subject", "Course", "Section", "Present", "Total", "Percentage"];
    const rows = attendanceRecords.map((record) => [
      new Date(record.date).toLocaleDateString(),
      record.subject,
      record.course,
      record.section,
      record.presentCount,
      record.totalCount,
      `${record.percentage}%`,
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "attendance-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const attendanceSummary = useMemo(() => {
    const totalSessions = attendanceRecords.length;
    const totalMarked = attendanceRecords.reduce((sum, record) => sum + record.totalCount, 0);
    const totalPresent = attendanceRecords.reduce((sum, record) => sum + record.presentCount, 0);
    const averageAttendance =
      totalMarked === 0 ? 0 : Number(((totalPresent / totalMarked) * 100).toFixed(2));

    return {
      totalSessions,
      totalMarked,
      totalPresent,
      averageAttendance,
    };
  }, [attendanceRecords]);

  const closeAttendanceEditModal = () => {
    setAttendanceEditRecord(null);
    setAttendanceEditStudents([]);
    setAttendanceEditStatus({});
    setAttendanceEditLoading(false);
    setAttendanceEditSaving(false);
  };

  const handleAttendanceEditChange = (studentId, status) => {
    setAttendanceEditStatus((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const openAttendanceEditModal = async (record) => {
    if (!record.classId) {
      setError("This attendance session is not linked to a class, so it cannot be edited.");
      return;
    }

    setAttendanceEditRecord({ ...record, sessionDate: toDateInputValue(record.date) });
    setAttendanceEditStudents([]);
    setAttendanceEditStatus({});
    setAttendanceEditLoading(true);
    setError("");

    try {
      const [sessionResponse, studentsResponse] = await Promise.all([
        attendanceAPI.getClassAttendanceSession(record.classId, toDateInputValue(record.date)),
        classAPI.getClassStudents(record.classId),
      ]);

      const nextStatus = {};
      studentsResponse.forEach((student) => {
        nextStatus[student._id] = "";
      });
      sessionResponse.students.forEach((student) => {
        nextStatus[student.studentId] = student.status;
      });

      setAttendanceEditStudents(studentsResponse);
      setAttendanceEditStatus(nextStatus);
    } catch (err) {
      setError(err.message || "Failed to load attendance session");
      closeAttendanceEditModal();
    } finally {
      setAttendanceEditLoading(false);
    }
  };

  const handleSaveAttendanceEdit = async () => {
    if (!attendanceEditRecord?.classId || !attendanceEditRecord?.sessionDate) {
      setError("No attendance session selected for editing");
      return;
    }

    const filledStatuses = Object.fromEntries(
      Object.entries(attendanceEditStatus).filter(([, status]) => status),
    );

    if (Object.keys(filledStatuses).length !== attendanceEditStudents.length) {
      setError("Please mark attendance for every student before updating");
      return;
    }

    setAttendanceEditSaving(true);

    try {
      await classAPI.updateClassAttendance(
        attendanceEditRecord.classId,
        filledStatuses,
        attendanceEditRecord.sessionDate,
      );
      const statsResponse = await adminAPI.getDashboardStats();
      setStatsData(statsResponse);
      await loadAttendanceRecords(attendanceFilters);
      setSuccessMessage("Attendance record updated successfully");
      closeAttendanceEditModal();
    } catch (err) {
      setError(err.message || "Failed to update attendance record");
    } finally {
      setAttendanceEditSaving(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-topbar">
        <div className="topbar-left"><h1>Admin Portal</h1></div>
        <div className="topbar-right">
          <button
            className="profile-menu-btn"
            onClick={toggleTheme}
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
          <div className="profile-menu-wrapper">
            <button className="profile-menu-btn" onClick={() => setShowProfileMenu((prev) => !prev)} title="Profile settings">
              Settings
            </button>
            {showProfileMenu && (
              <div className="profile-menu-dropdown">
                <button className="menu-item" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}<button onClick={() => setError("")}>X</button></div>}
      {successMessage && (
        <div className="error-banner" style={{ background: "#dcfce7", color: "#166534" }}>
          {successMessage}
          <button onClick={() => setSuccessMessage("")}>X</button>
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="dashboard-header">
            <h1>Admin Dashboard</h1>
            <p>Build and manage the university's academic structure.</p>
          </div>

          <div className="glass-panel profile-section">
            <div className="profile-container">
              <div className="profile-image-wrapper">
                <img src={adminData.profilePhoto} alt="Admin" className="profile-image" />
                <div className="profile-badge">Admin</div>
              </div>
              <div className="profile-info">
                <h2 className="profile-name">{adminData.name}</h2>
                <div className="profile-details">
                  <div className="detail-item">
                    <span className="detail-label">Admin ID</span>
                    <span className="detail-value">{adminData.adminId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{adminData.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Role</span>
                    <span className="detail-value">{adminData.role}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`stat-card stat-card-${stat.color}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="stat-icon">{stat.icon}</div>
                <span className="stat-label">{stat.label}</span>
                <h2 className="stat-value">{stat.value}</h2>
              </div>
            ))}
          </div>

          <div className="nav-tabs">
            <button className={`nav-tab ${activeTab === "students" ? "active" : ""}`} onClick={() => setActiveTab("students")}><span className="tab-icon">Students</span></button>
            <button className={`nav-tab ${activeTab === "professors" ? "active" : ""}`} onClick={() => setActiveTab("professors")}><span className="tab-icon">Professors</span></button>
            <button className={`nav-tab ${activeTab === "courses" ? "active" : ""}`} onClick={() => setActiveTab("courses")}><span className="tab-icon">Courses</span></button>
            <button className={`nav-tab ${activeTab === "classes" ? "active" : ""}`} onClick={() => setActiveTab("classes")}><span className="tab-icon">Schedules</span></button>
            <button className={`nav-tab ${activeTab === "attendance" ? "active" : ""}`} onClick={() => setActiveTab("attendance")}><span className="tab-icon">Attendance</span></button>
            <button className={`nav-tab ${activeTab === "configuration" ? "active" : ""}`} onClick={() => setActiveTab("configuration")}><span className="tab-icon">Configuration</span></button>
            <button className={`nav-tab ${activeTab === "announcements" ? "active" : ""}`} onClick={() => setActiveTab("announcements")}><span className="tab-icon">Announcements</span></button>
          </div>

          {activeTab === "students" && (
            <div className="tab-content">
              <div className="glass-panel">
                <div className="section-header">
                  <h3>Manage Students</h3>
                  <button className="add-btn" onClick={() => openModal("student")}>Add Student</button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Semester</th><th>Section</th><th>Actions</th></tr></thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student._id}>
                          <td>{student.name}</td>
                          <td>{student.email}</td>
                          <td>{student.department || "-"}</td>
                          <td>{student.semester || "-"}</td>
                          <td>{student.section || "-"}</td>
                          <td>
                            <button className="action-btn edit" onClick={() => openModal("student", student)}>Edit</button>
                            <button className="action-btn delete" onClick={() => handleDeleteUser(student._id, "student")}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "professors" && (
            <div className="tab-content">
              <div className="glass-panel">
                <div className="section-header">
                  <h3>Manage Professors</h3>
                  <button className="add-btn" onClick={() => openModal("professor")}>Add Professor</button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Assigned Courses</th><th>Actions</th></tr></thead>
                    <tbody>
                      {professors.map((professor) => (
                        <tr key={professor._id}>
                          <td>{professor.name}</td>
                          <td>{professor.email}</td>
                          <td>{courses.filter((course) => course.professor?._id === professor._id).length}</td>
                          <td>
                            <button className="action-btn edit" onClick={() => openModal("professor", professor)}>Edit</button>
                            <button className="action-btn delete" onClick={() => handleDeleteUser(professor._id, "professor")}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "courses" && (
            <div className="tab-content">
              <div className="glass-panel">
                <div className="section-header">
                  <h3>Manage Courses</h3>
                  <button className="add-btn" onClick={() => openModal("course")}>Add Course</button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Code</th><th>Semester</th><th>Department</th><th>Professor</th><th>Actions</th></tr></thead>
                    <tbody>
                      {courses.map((course) => (
                        <tr key={course._id}>
                          <td>{course.name}</td>
                          <td className="code-cell">{course.code}</td>
                          <td>{course.semester}</td>
                          <td>{course.department || "-"}</td>
                          <td>{course.professor?.name || "Unassigned"}</td>
                          <td>
                            <button className="action-btn edit" onClick={() => openModal("course", course)}>Edit</button>
                            <button className="action-btn delete" onClick={() => handleDeleteCourse(course._id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "classes" && (
            <div className="tab-content">
              <div className="glass-panel">
                <div className="section-header">
                  <h3>Manage Class Schedules</h3>
                  <button className="add-btn" onClick={() => openModal("class")}>Add Class</button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Subject</th><th>Course</th><th>Section</th><th>Professor</th><th>Schedule</th><th>Students</th><th>Actions</th></tr></thead>
                    <tbody>
                      {classes.map((classItem) => (
                        <tr key={classItem._id}>
                          <td>{classItem.subject}</td>
                          <td>{classItem.course}</td>
                          <td>{classItem.section}</td>
                          <td>{classItem.professor?.name || "Unassigned"}</td>
                          <td>{formatDateLabel(classItem.scheduleDate)}<br /><span className="detail-label">{classItem.startTime} - {classItem.endTime}{classItem.room ? ` / ${classItem.room}` : ""}</span></td>
                          <td>{classItem.students?.length || 0}</td>
                          <td>
                            <button className="action-btn edit" onClick={() => openModal("class", classItem)}>Edit</button>
                            <button className="action-btn delete" onClick={() => handleDeleteClass(classItem._id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="tab-content">
              <div className="glass-panel">
                <div className="section-header">
                  <h3>Attendance Monitoring</h3>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <button className="add-btn" onClick={() => loadAttendanceRecords()}>Apply Filters</button>
                    <button className="btn-cancel" onClick={exportAttendanceCsv}>Export CSV</button>
                  </div>
                </div>

                <div className="form-group-container" style={{ marginBottom: "1.5rem" }}>
                  <div className="form-group">
                    <label>Student</label>
                    <select
                      name="studentId"
                      value={attendanceFilters.studentId}
                      onChange={handleAttendanceFilterChange}
                    >
                      <option value="">All students</option>
                      {studentOptions.map((student) => (
                        <option key={student.value} value={student.value}>{student.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Course Code</label>
                    <select
                      name="course"
                      value={attendanceFilters.course}
                      onChange={handleAttendanceFilterChange}
                    >
                      <option value="">All courses</option>
                      {courses.map((course) => (
                        <option key={course._id} value={course.code}>{course.name} ({course.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      name="date"
                      value={attendanceFilters.date}
                      onChange={handleAttendanceFilterChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Reset</label>
                    <button
                      className="btn-cancel"
                      onClick={() => {
                        const nextFilters = { studentId: "", course: "", date: "" };
                        setAttendanceFilters(nextFilters);
                        loadAttendanceRecords(nextFilters);
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>

                <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
                  <div className="stat-card stat-card-green">
                    <div className="stat-icon">🧾</div>
                    <span className="stat-label">Sessions</span>
                    <h2 className="stat-value">{attendanceSummary.totalSessions}</h2>
                  </div>
                  <div className="stat-card stat-card-blue">
                    <div className="stat-icon">✅</div>
                    <span className="stat-label">Present Marks</span>
                    <h2 className="stat-value">{attendanceSummary.totalPresent}</h2>
                  </div>
                  <div className="stat-card stat-card-orange">
                    <div className="stat-icon">📈</div>
                    <span className="stat-label">Average %</span>
                    <h2 className="stat-value">{attendanceSummary.averageAttendance}%</h2>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Course</th>
                        <th>Section</th>
                        <th>Present / Total</th>
                        <th>Percentage</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRecords.length > 0 ? (
                        attendanceRecords.map((record) => (
                          <tr key={record.id}>
                            <td>{new Date(record.date).toLocaleDateString()}</td>
                            <td>{record.subject}</td>
                            <td>{record.course}</td>
                            <td>{record.section}</td>
                            <td>{record.presentCount}/{record.totalCount}</td>
                            <td>{record.percentage}%</td>
                            <td>
                              <button className="action-btn edit" onClick={() => openAttendanceEditModal(record)}>
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="no-data">No attendance records match these filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "configuration" && (
            <div className="tab-content">
              <div className="glass-panel">
                <div className="section-header">
                  <h3>Academic Configuration</h3>
                  <p className="section-subtitle">Manage active departments, semesters, and sections for the whole college</p>
                </div>

                <div className="form-group-container" style={{ marginBottom: "1.5rem" }}>
                  <div className="form-group">
                    <label>Add Department</label>
                    <input
                      name="department"
                      value={academicItemForm.department}
                      onChange={handleAcademicItemChange}
                      placeholder="Computer Science"
                    />
                    <button className="add-btn" type="button" onClick={() => handleAddAcademicItem("department")}>
                      Add Department
                    </button>
                  </div>
                  <div className="form-group">
                    <label>Add Semester</label>
                    <input
                      name="semester"
                      value={academicItemForm.semester}
                      onChange={handleAcademicItemChange}
                      placeholder="Semester 4"
                    />
                    <button className="add-btn" type="button" onClick={() => handleAddAcademicItem("semester")}>
                      Add Semester
                    </button>
                  </div>
                  <div className="form-group">
                    <label>Add Section</label>
                    <input
                      name="section"
                      value={academicItemForm.section}
                      onChange={handleAcademicItemChange}
                      placeholder="A"
                    />
                    <button className="add-btn" type="button" onClick={() => handleAddAcademicItem("section")}>
                      Add Section
                    </button>
                  </div>
                </div>

                <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                  <div className="glass-panel" style={{ marginBottom: 0 }}>
                    <div className="section-header">
                      <h3>Departments</h3>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      {departmentOptions.length > 0 ? departmentOptions.map((item) => (
                        <button key={item} className="action-btn edit" type="button" onClick={() => handleRemoveAcademicItem("department", item)}>
                          {item} ×
                        </button>
                      )) : <div className="no-data">No departments configured yet.</div>}
                    </div>
                  </div>
                  <div className="glass-panel" style={{ marginBottom: 0 }}>
                    <div className="section-header">
                      <h3>Semesters</h3>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      {semesterOptions.length > 0 ? semesterOptions.map((item) => (
                        <button key={item} className="action-btn edit" type="button" onClick={() => handleRemoveAcademicItem("semester", item)}>
                          {item} ×
                        </button>
                      )) : <div className="no-data">No semesters configured yet.</div>}
                    </div>
                  </div>
                  <div className="glass-panel" style={{ marginBottom: 0 }}>
                    <div className="section-header">
                      <h3>Sections</h3>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      {sectionOptions.length > 0 ? sectionOptions.map((item) => (
                        <button key={item} className="action-btn edit" type="button" onClick={() => handleRemoveAcademicItem("section", item)}>
                          {item} ×
                        </button>
                      )) : <div className="no-data">No sections configured yet.</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "announcements" && (
            <div className="tab-content">
              <div className="glass-panel">
                <div className="section-header">
                  <h3>Announcements</h3>
                  <p className="section-subtitle">Send updates to students and professors</p>
                </div>

                <div className="form-group-container" style={{ marginBottom: "1.5rem" }}>
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      name="title"
                      value={notificationForm.title}
                      onChange={(event) =>
                        setNotificationForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Message</label>
                    <input
                      name="message"
                      value={notificationForm.message}
                      onChange={(event) =>
                        setNotificationForm((prev) => ({ ...prev, message: event.target.value }))
                      }
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Target Roles</label>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                      {["student", "professor", "admin"].map((role) => (
                        <label key={role} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={notificationForm.targetRoles.includes(role)}
                            onChange={() => toggleTargetRole(role)}
                          />
                          <span style={{ textTransform: "capitalize" }}>{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Target Course</label>
                    <select
                      value={notificationForm.targetCourse}
                      onChange={(event) => handleNotificationInputChange("targetCourse", event.target.value)}
                    >
                      <option value="">All courses</option>
                      {courses.map((course) => (
                        <option key={course._id} value={course._id}>
                          {course.name} ({course.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target Class</label>
                    <select
                      value={notificationForm.targetClass}
                      onChange={(event) => handleNotificationInputChange("targetClass", event.target.value)}
                    >
                      <option value="">All classes</option>
                      {classes.map((classItem) => (
                        <option key={classItem._id} value={classItem._id}>
                          {classItem.subject} / Sem {classItem.semester} / Sec {classItem.section}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target Semester</label>
                    <select
                      value={notificationForm.targetSemester}
                      onChange={(event) => handleNotificationInputChange("targetSemester", event.target.value)}
                    >
                      <option value="">All semesters</option>
                      {semesterOptions.map((semester) => (
                        <option key={semester} value={semester}>Semester {semester}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target Section</label>
                    <select
                      value={notificationForm.targetSection}
                      onChange={(event) => handleNotificationInputChange("targetSection", event.target.value)}
                    >
                      <option value="">All sections</option>
                      {sectionOptions.map((section) => (
                        <option key={section} value={section}>Section {section}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: 0, border: "none", background: "transparent", justifyContent: "flex-start", marginBottom: "1.5rem" }}>
                  <button className="btn-save" onClick={handleSendAnnouncement}>Send Announcement</button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Message</th>
                        <th>Targets</th>
                        <th>Filters</th>
                        <th>Author</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <tr key={notification._id}>
                            <td>{notification.title}</td>
                            <td>{notification.message}</td>
                            <td>{notification.targetRoles.join(", ")}</td>
                            <td>{getNotificationTargetSummary(notification)}</td>
                            <td>{notification.author?.name || "Admin"}</td>
                            <td>{new Date(notification.createdAt).toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="no-data">No announcements sent yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingId ? "Edit" : "Add"}{" "}
                {modalType === "student"
                  ? "Student"
                  : modalType === "professor"
                    ? "Professor"
                    : modalType === "course"
                      ? "Course"
                      : "Class Schedule"}
              </h2>
              <button className="modal-close" onClick={closeModal}>X</button>
            </div>

            <div className="modal-body">
              {(modalType === "student" || modalType === "professor") && (
                <div className="form-group-container">
                  <div className="form-group">
                    <label>Name</label>
                    <input type="text" name="name" value={formData.name || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value={formData.email || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Password {editingId && "(optional reset)"}</label>
                    <input type="password" name="password" value={formData.password || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select name="department" value={formData.department || ""} onChange={handleInputChange}>
                      <option value="">Select department</option>
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </div>
                  {modalType === "student" && (
                    <>
                      <div className="form-group">
                        <label>Semester</label>
                        <select name="semester" value={formData.semester || ""} onChange={handleInputChange}>
                          <option value="">Select semester</option>
                          {semesterOptions.map((semester) => (
                            <option key={semester} value={semester}>{semester}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Section</label>
                        <select name="section" value={formData.section || ""} onChange={handleInputChange}>
                          <option value="">Select section</option>
                          {sectionOptions.map((section) => (
                            <option key={section} value={section}>{section}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}

              {modalType === "course" && (
                <div className="form-group-container">
                  <div className="form-group">
                    <label>Course Name</label>
                    <input name="name" value={formData.name || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Course Code</label>
                    <input name="code" value={formData.code || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Semester</label>
                    <select name="semester" value={formData.semester || ""} onChange={handleInputChange}>
                      <option value="">Select semester</option>
                      {semesterOptions.map((semester) => (
                        <option key={semester} value={semester}>{semester}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select name="department" value={formData.department || ""} onChange={handleInputChange}>
                      <option value="">Select department</option>
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Assigned Professor</label>
                    <select name="professor" value={formData.professor || ""} onChange={handleInputChange}>
                      <option value="">Select professor</option>
                      {professorOptions.map((professor) => (
                        <option key={professor.value} value={professor.value}>{professor.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Description</label>
                    <input name="description" value={formData.description || ""} onChange={handleInputChange} />
                  </div>
                </div>
              )}

              {modalType === "class" && (
                <div className="form-group-container">
                  <div className="form-group">
                    <label>Linked Course</label>
                    <select name="courseRef" value={formData.courseRef || ""} onChange={handleClassCourseChange}>
                      <option value="">Select course</option>
                      {courses.map((course) => (
                        <option key={course._id} value={course._id}>{course.name} ({course.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Subject</label>
                    <input name="subject" value={formData.subject || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Course Code / Program</label>
                    <input name="course" value={formData.course || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Semester</label>
                    <select name="semester" value={formData.semester || ""} onChange={handleInputChange}>
                      <option value="">Select semester</option>
                      {semesterOptions.map((semester) => (
                        <option key={semester} value={semester}>{semester}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Section</label>
                    <select name="section" value={formData.section || ""} onChange={handleInputChange}>
                      <option value="">Select section</option>
                      {sectionOptions.map((section) => (
                        <option key={section} value={section}>{section}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Professor</label>
                    <select name="professor" value={formData.professor || ""} onChange={handleInputChange}>
                      <option value="">Select professor</option>
                      {professorOptions.map((professor) => (
                        <option key={professor.value} value={professor.value}>{professor.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Schedule Date</label>
                    <input type="date" name="scheduleDate" value={formData.scheduleDate || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Start Time</label>
                    <input type="time" name="startTime" value={formData.startTime || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input type="time" name="endTime" value={formData.endTime || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Room</label>
                    <input name="room" value={formData.room || ""} onChange={handleInputChange} />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Assign Students</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Semester Filter</label>
                        <select
                          name="semester"
                          value={formData.semester || ""}
                          onChange={handleInputChange}
                        >
                          <option value="">Select semester</option>
                          {semesterOptions.map((semester) => (
                            <option key={semester} value={semester}>Semester {semester}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Section Filter</label>
                        <select
                          name="section"
                          value={formData.section || ""}
                          onChange={handleInputChange}
                        >
                          <option value="">Select section</option>
                          {sectionOptions.map((section) => (
                            <option key={section} value={section}>Section {section}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0, justifyContent: "flex-end" }}>
                        <label>Quick Actions</label>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button type="button" className="btn-cancel" onClick={handleSelectFilteredStudents}>
                            Select Filtered
                          </button>
                          <button type="button" className="btn-cancel" onClick={handleClearFilteredStudents}>
                            Clear Filtered
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="table-wrapper" style={{ maxHeight: "220px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        {filteredStudentOptions.map((student) => (
                          <label
                            key={student.value}
                            style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", padding: "0.75rem", border: "1px solid var(--border-primary)", borderRadius: "12px" }}
                          >
                            <input type="checkbox" checked={(formData.students || []).includes(student.value)} onChange={() => handleStudentSelection(student.value)} />
                            <span>{student.label}<br />Semester {student.semester || "-"} / Section {student.section || "-"}</span>
                          </label>
                        ))}
                        {filteredStudentOptions.length === 0 && (
                          <div className="no-data">No students match the selected semester and section.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button
                className="btn-save"
                onClick={() => {
                  if (modalType === "student") handleSaveUser("student");
                  else if (modalType === "professor") handleSaveUser("professor");
                  else if (modalType === "course") handleSaveCourse();
                  else handleSaveClass();
                }}
              >
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {attendanceEditRecord && (
        <div className="modal-overlay" onClick={closeAttendanceEditModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Attendance Session</h2>
              <button className="modal-close" onClick={closeAttendanceEditModal}>X</button>
            </div>

            <div className="modal-body">
              <div className="form-group-container" style={{ marginBottom: "1rem" }}>
                <div className="form-group">
                  <label>Date</label>
                  <input value={new Date(attendanceEditRecord.date).toLocaleDateString()} readOnly />
                </div>
                <div className="form-group">
                  <label>Subject</label>
                  <input value={attendanceEditRecord.subject || ""} readOnly />
                </div>
                <div className="form-group">
                  <label>Course</label>
                  <input value={attendanceEditRecord.course || ""} readOnly />
                </div>
                <div className="form-group">
                  <label>Section</label>
                  <input value={attendanceEditRecord.section || ""} readOnly />
                </div>
              </div>

              {attendanceEditLoading ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>Loading attendance session...</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: "420px" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceEditStudents.map((student) => (
                        <tr key={student._id}>
                          <td>{getStudentAcademicId(student)}</td>
                          <td>{student.name}</td>
                          <td>{student.email}</td>
                          <td>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="action-btn edit"
                                style={{
                                  background:
                                    attendanceEditStatus[student._id] === "present"
                                      ? "#dcfce7"
                                      : "rgba(16, 185, 129, 0.12)",
                                  color: "#047857",
                                }}
                                onClick={() => handleAttendanceEditChange(student._id, "present")}
                              >
                                Present
                              </button>
                              <button
                                type="button"
                                className="action-btn delete"
                                style={{
                                  background:
                                    attendanceEditStatus[student._id] === "absent"
                                      ? "#fee2e2"
                                      : "rgba(239, 68, 68, 0.12)",
                                  color: "#b91c1c",
                                }}
                                onClick={() => handleAttendanceEditChange(student._id, "absent")}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {attendanceEditStudents.length === 0 && (
                        <tr>
                          <td colSpan="4" className="no-data">No students found for this attendance session.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeAttendanceEditModal}>Cancel</button>
              <button
                className="btn-save"
                onClick={handleSaveAttendanceEdit}
                disabled={attendanceEditLoading || attendanceEditSaving}
              >
                {attendanceEditSaving ? "Updating..." : "Update Attendance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
