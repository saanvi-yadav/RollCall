import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import InputField from "../components/InputField";
import SelectField from "../components/SelectField";
import PrimaryButton from "../components/PrimaryButton";
import { setAuthToken, setCurrentUser, userAPI } from "../utils/apiClient";

const getAcademicId = (email = "") => email.trim().toLowerCase().split("@")[0] || "";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSignup = async () => {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !password || !role) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await userAPI.register({
        name: normalizedName,
        email: normalizedEmail,
        password,
        role,
      });

      const loginResponse = await userAPI.login(
        normalizedEmail,
        password,
        role,
      );
      setAuthToken(loginResponse.token);

      setCurrentUser({
        id: loginResponse._id,
        name: loginResponse.name,
        email: loginResponse.email,
        role: loginResponse.role,
        username: loginResponse.username || getAcademicId(loginResponse.email),
        department: loginResponse.department || "",
        semester: loginResponse.semester || "",
        section: loginResponse.section || "",
      });

      if (loginResponse.role === "student") navigate("/student/dashboard");
      else if (loginResponse.role === "professor")
        navigate("/professor/dashboard");
      else navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
      console.error("Signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-brand-row">
        <div className="auth-brand-pill">Attendance Tracking System</div>
        <div className="auth-brand-dot" aria-hidden="true" />
      </div>

      <h2 className="auth-title">Create Account</h2>
      <p className="auth-subtitle">
        Join the portal to track attendance and class activities.
      </p>

      {error && (
        <div className="auth-alert" role="alert">
          {error}
        </div>
      )}

      <div className="auth-form">
        <InputField
          label="Full Name"
          placeholder="Enter your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />

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
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />

        <SelectField
          label="Register As"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: "", label: "Select Role" },
            { value: "student", label: "Student" },
            { value: "professor", label: "Professor" },
          ]}
          disabled={loading}
        />

        <PrimaryButton
          text={loading ? "Creating account..." : "Sign Up"}
          onClick={handleSignup}
          disabled={loading}
        />
      </div>

      <p className="auth-switch">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="auth-switch-btn"
        >
          Login
        </button>
      </p>
    </AuthLayout>
  );
};

export default Signup;
