import "../styles/auth-theme.css";
import { useTheme } from "../context/ThemeContext";

const AuthLayout = ({ children }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="auth-shell">
      <div className="auth-layer auth-layer-grid" aria-hidden="true" />
      <div
        className="auth-layer auth-layer-orb auth-layer-orb-a"
        aria-hidden="true"
      />
      <div
        className="auth-layer auth-layer-orb auth-layer-orb-b"
        aria-hidden="true"
      />
      <div className="auth-layer auth-layer-glow" aria-hidden="true" />

      <button
        onClick={toggleTheme}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 100,
          background: "rgba(255, 255, 255, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          borderRadius: "12px",
          padding: "10px 14px",
          fontSize: "20px",
          cursor: "pointer",
          backdropFilter: "blur(10px)",
          transition: "all 0.3s ease",
          color: "white",
        }}
        title="Toggle dark/light theme"
        onMouseEnter={(e) => {
          e.target.style.background = "rgba(255, 255, 255, 0.3)";
          e.target.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          e.target.style.background = "rgba(255, 255, 255, 0.2)";
          e.target.style.transform = "scale(1)";
        }}
      >
        {isDark ? "☀️" : "🌙"}
      </button>

      <div className="auth-card">{children}</div>
    </div>
  );
};

export default AuthLayout;
