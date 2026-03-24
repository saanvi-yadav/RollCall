import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const AdminLayout = ({ children }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "240px",
          background: isDark
            ? "linear-gradient(180deg, #0f172a, #111827, #1f2937)"
            : "linear-gradient(180deg, #111827, #1f2937, #020617)",
          color: "#ffffff",
          padding: "20px",
        }}
      >
        <h2 style={{ marginBottom: "32px", letterSpacing: "0.5px" }}>
          Admin Panel
        </h2>

        <nav style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Link style={linkStyle} to="/admin/dashboard">
            Dashboard
          </Link>
          <Link style={linkStyle} to="#">
            Manage Users
          </Link>
          <Link style={linkStyle} to="#">
            Classes
          </Link>
          <Link style={linkStyle} to="#">
            Attendance
          </Link>
          <Link style={linkStyle} to="#">
            Reports
          </Link>
        </nav>
      </aside>

      {/* Main Area */}
      <div
        style={{
          flex: 1,
          backgroundColor: isDark ? "var(--bg-primary)" : "#f3f4f6",
        }}
      >
        {/* Top bar */}
        <header
          style={{
            height: "64px",
            backgroundColor: isDark ? "var(--bg-secondary)" : "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            borderBottom: `1px solid ${isDark ? "var(--border-primary)" : "#e5e7eb"}`,
          }}
        >
          <button
            onClick={toggleTheme}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isDark ? "#fff" : "#1f2937",
              transition: "background-color 0.3s ease",
            }}
            title="Toggle dark/light theme"
          >
            {isDark ? "☀️" : "🌙"}
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: "600",
              }}
            >
              A
            </div>
            <span
              style={{
                fontSize: "14px",
                fontWeight: "500",
                color: isDark ? "#d1d5db" : "#1f2937",
              }}
            >
              Admin
            </span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: "24px" }}>{children}</main>
      </div>
    </div>
  );
};

const linkStyle = {
  color: "#d1d5db",
  textDecoration: "none",
  fontSize: "15px",
};

export default AdminLayout;
