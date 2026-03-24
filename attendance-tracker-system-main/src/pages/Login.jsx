import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import InputField from "../components/InputField";
import SelectField from "../components/SelectField";
import PrimaryButton from "../components/PrimaryButton";
import { userAPI, setAuthToken } from "../utils/apiClient";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || !role) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await userAPI.login(normalizedEmail, password, role);

      // Store the auth token
      setAuthToken(response.token);

      // Store user data
      localStorage.setItem(
        "currentUser",
        JSON.stringify({
          id: response._id,
          name: response.name,
          email: response.email,
          role: response.role,
        }),
      );

      // Navigate based on role
      if (response.role === "student") navigate("/student/dashboard");
      else if (response.role === "professor") navigate("/professor/dashboard");
      else if (response.role === "admin") navigate("/admin/dashboard");
    } catch (err) {
      if (err.message === "Role mismatch for this account") {
        setError(
          "Role does not match this account. Please choose the correct role.",
        );
      } else {
        setError(err.message || "Login failed. Please check your credentials.");
      }
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-brand-row">
        <div className="auth-brand-pill">University Portal</div>
        <div className="auth-brand-dot" aria-hidden="true" />
      </div>

      <h2 className="auth-title">Welcome Back</h2>
      <p className="auth-subtitle">
        Sign in to manage attendance, classes, and reports.
      </p>

      {error && (
        <div className="auth-alert" role="alert">
          {error}
        </div>
      )}

      <div className="auth-form">
        <InputField
          label="Institute Email"
          placeholder="name@youruniversity.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />

        <InputField
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />

        <SelectField
          label="Login As"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: "", label: "Select Role" },
            { value: "student", label: "Student" },
            { value: "professor", label: "Professor" },
            { value: "admin", label: "Admin" },
          ]}
          disabled={loading}
        />

        <PrimaryButton
          text={loading ? "Logging in..." : "Login"}
          onClick={handleLogin}
          disabled={loading}
        />
      </div>

      <p className="auth-switch">
        New user?{" "}
        <button
          type="button"
          onClick={() => navigate("/signup")}
          className="auth-switch-btn"
        >
          Create account
        </button>
      </p>
    </AuthLayout>
  );
};

export default Login;
