import React, { useState } from "react";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";

const API = "https://timer-server-moyt.onrender.com/api/auth";

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); 
  // login | register | otp

  const [form, setForm] = useState({
    email: "",
    password: "",
    otp: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await axios.post(`${API}/register`, {
        email: form.email,
        password: form.password
      });

      setSuccess("Registered! Check console for OTP (demo).");
      setMode("otp");

    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axios.post(
        `${API}/login`,
        {
          email: form.email,
          password: form.password
        },
        { withCredentials: true }
      );

      localStorage.setItem("accessToken", res.data.accessToken);
      setSuccess("Login successful!");
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axios.post(
        `${API}/verify-otp`,
        {
          email: form.email,
          otp: form.otp
        },
        { withCredentials: true }
      );

      localStorage.setItem("accessToken", res.data.accessToken);
      setSuccess("OTP verified. Logged in!");
    } catch (err) {
      setError(err.response?.data?.message || "OTP failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError("");

      const res = await axios.post(
        `${API}/google`,
        { credential: credentialResponse.credential },
        { withCredentials: true }
      );

      localStorage.setItem("accessToken", res.data.accessToken);
      setSuccess("Google login successful!");
      navigate('/dashboard')
    } catch (err) {
      setError("Google login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Auth System</h2>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {(mode === "login" || mode === "register") && (
        <>
          <input
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            style={styles.input}
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            style={styles.input}
          />
        </>
      )}

      {mode === "otp" && (
        <>
          <input
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            style={styles.input}
          />
          <input
            name="otp"
            placeholder="Enter OTP"
            value={form.otp}
            onChange={handleChange}
            style={styles.input}
          />
        </>
      )}

      {mode === "login" && (
        <>
          <button onClick={handleLogin} disabled={loading} style={styles.btn}>
            {loading ? "Loading..." : "Login"}
          </button>

          <p onClick={() => setMode("register")} style={styles.link}>
            Don't have account? Register
          </p>
        </>
      )}

      {mode === "register" && (
        <>
          <button onClick={handleRegister} disabled={loading} style={styles.btn}>
            {loading ? "Loading..." : "Register"}
          </button>

          <p onClick={() => setMode("login")} style={styles.link}>
            Already have account? Login
          </p>
        </>
      )}

      {mode === "otp" && (
        <>
          <button onClick={handleVerifyOtp} disabled={loading} style={styles.btn}>
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </>
      )}

      <hr />

      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => setError("Google Login Failed")}
      />
    </div>
  );
}

const styles = {
  container: {
    width: "350px",
    margin: "100px auto",
    padding: "20px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    textAlign: "center"
  },
  input: {
    width: "100%",
    padding: "10px",
    margin: "8px 0"
  },
  btn: {
    width: "100%",
    padding: "10px",
    marginTop: "10px"
  },
  error: {
    color: "red",
    marginBottom: "10px"
  },
  success: {
    color: "green",
    marginBottom: "10px"
  },
  link: {
    color: "blue",
    cursor: "pointer",
    marginTop: "10px"
  }
};