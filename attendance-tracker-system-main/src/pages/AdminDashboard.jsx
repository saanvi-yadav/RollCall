import { useState, useEffect } from "react";
import "../styles/admin-dashboard.css";
import { adminAPI, clearAuthToken } from "../utils/apiClient";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adminData] = useState({
    name: "Admin User",
    adminId: "ADMIN001",
    email: "admin@attendance.com",
    role: "System Admin",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Admin+User&size=150&background=4f46e5&color=fff",
  });

  const [activeTab, setActiveTab] = useState("students");
  const [students, setStudents] = useState([]);
  const [professors, setProfessors] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Load admin data on mount
  useEffect(() => {
    const loadAdminData = async () => {
      try {
        setLoading(true);
        const [studentsResponse, professorsResponse] = await Promise.all([
          adminAPI.getAllStudents(),
          adminAPI.getAllProfessors(),
        ]);
        setStudents(studentsResponse);
        setProfessors(professorsResponse);
        setError("");
      } catch (err) {
        console.error("Admin dashboard load error:", err);
        setError(err.message || "Failed to load admin dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, []);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});

  // Summary stats
  const stats = [
    {
      label: "Total Students",
      value: students.length,
      color: "blue",
      icon: "👥",
    },
    {
      label: "Total Professors",
      value: professors.length,
      color: "orange",
      icon: "👨‍🎓",
    },
    { label: "Total Courses", value: 0, color: "green", icon: "📚" },
    { label: "Total Classes", value: 0, color: "purple", icon: "🏫" },
  ];

  const handleLogout = () => {
    clearAuthToken();
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    if (item) {
      setEditingId(item._id);
      setFormData(item);
    } else {
      setFormData({});
      setEditingId(null);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType(null);
    setEditingId(null);
    setFormData({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveStudent = async () => {
    try {
      if (editingId) {
        await adminAPI.updateUser(editingId, formData);
        setStudents(
          students.map((s) =>
            s._id === editingId ? { ...s, ...formData } : s,
          ),
        );
      } else {
        const newStudent = await adminAPI.createUser({
          ...formData,
          role: "student",
        });
        setStudents([...students, newStudent]);
      }
      closeModal();
      alert(
        editingId
          ? "Student updated successfully"
          : "Student created successfully",
      );
    } catch (err) {
      alert(err.message || "Failed to save student");
    }
  };

  const handleSaveProfessor = async () => {
    try {
      if (editingId) {
        await adminAPI.updateUser(editingId, formData);
        setProfessors(
          professors.map((p) =>
            p._id === editingId ? { ...p, ...formData } : p,
          ),
        );
      } else {
        const newProfessor = await adminAPI.createUser({
          ...formData,
          role: "professor",
        });
        setProfessors([...professors, newProfessor]);
      }
      closeModal();
      alert(
        editingId
          ? "Professor updated successfully"
          : "Professor created successfully",
      );
    } catch (err) {
      alert(err.message || "Failed to save professor");
    }
  };

  const deleteStudent = async (id) => {
    if (confirm("Are you sure you want to delete this student?")) {
      try {
        await adminAPI.deleteUser(id);
        setStudents(students.filter((s) => s._id !== id));
        alert("Student deleted successfully");
      } catch (err) {
        alert(err.message || "Failed to delete student");
      }
    }
  };

  const deleteProfessor = async (id) => {
    if (confirm("Are you sure you want to delete this professor?")) {
      try {
        await adminAPI.deleteUser(id);
        setProfessors(professors.filter((p) => p._id !== id));
        alert("Professor deleted successfully");
      } catch (err) {
        alert(err.message || "Failed to delete professor");
      }
    }
  };

  return (
    <div className="admin-dashboard">
      {/* Top Navigation Bar */}
      <div className="dashboard-topbar">
        <div className="topbar-left">
          <h1>🔐 Admin Portal</h1>
        </div>
        <div className="topbar-right">
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
                <button className="menu-item" onClick={handleLogout}>
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="dashboard-header">
            <h1>Admin Dashboard</h1>
            <p>Manage system resources and user accounts</p>
          </div>

          {/* Admin Profile Section */}
          <div className="glass-panel profile-section">
            <div className="profile-container">
              <div className="profile-image-wrapper">
                <img
                  src={adminData.profilePhoto}
                  alt="Admin"
                  className="profile-image"
                />
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

          {/* Summary Stats */}
          <div className="stats-grid">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className={`stat-card stat-card-${stat.color}`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="stat-icon">{stat.icon}</div>
                <span className="stat-label">{stat.label}</span>
                <h2 className="stat-value">{stat.value}</h2>
              </div>
            ))}
          </div>

          {/* Navigation Tabs */}
          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === "students" ? "active" : ""}`}
              onClick={() => setActiveTab("students")}
            >
              <span className="tab-icon">👥</span> Manage Students
            </button>
            <button
              className={`nav-tab ${activeTab === "professors" ? "active" : ""}`}
              onClick={() => setActiveTab("professors")}
            >
              <span className="tab-icon">👨‍🎓</span> Manage Professors
            </button>
          </div>

          {/* STUDENTS TAB */}
          {activeTab === "students" && (
            <div className="tab-content">
              <div className="glass-panel">
                <div className="section-header">
                  <h3>Manage Students</h3>
                  <button
                    className="add-btn"
                    onClick={() => openModal("student")}
                  >
                    ➕ Add Student
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => (
                        <tr
                          key={student._id}
                          style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                          <td>{student.name}</td>
                          <td>{student.email}</td>
                          <td>
                            <button
                              className="action-btn edit"
                              onClick={() => openModal("student", student)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="action-btn delete"
                              onClick={() => deleteStudent(student._id)}
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PROFESSORS TAB */}
          {activeTab === "professors" && (
            <div className="tab-content">
              <div className="glass-panel">
                <div className="section-header">
                  <h3>Manage Professors</h3>
                  <button
                    className="add-btn"
                    onClick={() => openModal("professor")}
                  >
                    ➕ Add Professor
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {professors.map((professor, idx) => (
                        <tr
                          key={professor._id}
                          style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                          <td>{professor.name}</td>
                          <td>{professor.email}</td>
                          <td>
                            <button
                              className="action-btn edit"
                              onClick={() => openModal("professor", professor)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="action-btn delete"
                              onClick={() => deleteProfessor(professor._id)}
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODAL */}
          {showModal && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>
                    {editingId ? "Edit" : "Add"}{" "}
                    {modalType === "student" ? "Student" : "Professor"}
                  </h2>
                  <button className="modal-close" onClick={closeModal}>
                    ✕
                  </button>
                </div>

                <div className="modal-body">
                  <div className="form-group-container">
                    <div className="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name || ""}
                        onChange={handleInputChange}
                        placeholder="Enter name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email || ""}
                        onChange={handleInputChange}
                        placeholder="Enter email"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        Password {editingId && "(leave empty to keep current)"}
                      </label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password || ""}
                        onChange={handleInputChange}
                        placeholder="Enter password"
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="btn-cancel" onClick={closeModal}>
                    Cancel
                  </button>
                  <button
                    className="btn-save"
                    onClick={
                      modalType === "student"
                        ? handleSaveStudent
                        : handleSaveProfessor
                    }
                  >
                    {editingId ? "Update" : "Add"}{" "}
                    {modalType?.charAt(0).toUpperCase() + modalType?.slice(1)}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
