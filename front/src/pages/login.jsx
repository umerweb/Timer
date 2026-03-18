// src/pages/login.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";

const API         = import.meta.env.VITE_BACKEND_URL + "/api/auth";
const BILLING_API = import.meta.env.VITE_BACKEND_URL + "/api/billing";
const emailRegex  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordMinLength = 6;

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode,        setMode]        = useState("login"); // login | register | otp
  const [form,        setForm]        = useState({ email: "", password: "", otp: "" });
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // ── Post-login routing ────────────────────────────────────────────────────
  // Called after every successful login (email, OTP, Google)
  // Decides where to send the user based on:
  //   1. Do they already have a plan? → dashboard (existing user)
  //   2. Did they pick a plan on pricing page? → handle it
  //   3. No plan selected at all? → select-plan (pick one now)
  const handlePostLogin = async (token) => {
  console.log("🔵 handlePostLogin called");
  
  try {
    const res = await axios.get(`${BILLING_API}/plan`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("🟢 billing/plan response:", res.data);
    
    if (res.data.plan) {
      console.log("➡️ has plan, going to dashboard");
      localStorage.removeItem("pendingPlan");
      localStorage.removeItem("pendingPriceId");
      localStorage.removeItem("pendingInterval");
      navigate("/dashboard");
      return;
    }
  } catch (err) {
    console.log("🔴 billing/plan failed:", err.message);
  }

  const pendingPlan = localStorage.getItem("pendingPlan");
  console.log("🟡 pendingPlan:", pendingPlan);

  if (!pendingPlan) {
    console.log("➡️ no pending plan, going to select-plan");
    navigate("/select-plan");
    return;
  }

  if (pendingPlan === "free") {
    console.log("➡️ free plan, setting free and going to dashboard");
    // ... rest stays same
  }

  console.log("➡️ paid plan, going to select-plan");
  navigate("/select-plan");
};

  // ── Form handlers ─────────────────────────────────────────────────────────
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    if (!emailRegex.test(form.email)) return "Invalid email address";
    if ((mode === "register" || mode === "login") && form.password.length < passwordMinLength)
      return `Password must be at least ${passwordMinLength} characters`;
    if (mode === "otp" && form.otp.length !== 6) return "OTP must be 6 digits";
    return null;
  };

  const handleRegister = async () => {
    const errMsg = validate();
    if (errMsg) return setError(errMsg);
    try {
      setLoading(true); setError(""); setSuccess("");
      await axios.post(`${API}/register`, { email: form.email, password: form.password });
      setSuccess("Verify with OTP sent to your email");
      setMode("otp");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    const errMsg = validate();
    if (errMsg) return setError(errMsg);
    try {
      setLoading(true); setError(""); setSuccess("");
      const res = await axios.post(`${API}/login`, { email: form.email, password: form.password }, { withCredentials: true });
      localStorage.setItem("accessToken", res.data.accessToken);
      await handlePostLogin(res.data.accessToken);
    } catch (err) {
      const data = err.response?.data;
      if (data?.email) {
        setForm(f => ({ ...f, email: data.email, password: "" }));
        setSuccess("Account not verified. OTP sent to your email.");
        setMode("otp");
      } else {
        setError(data?.message || "Login failed");
      }
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    const errMsg = validate();
    if (errMsg) return setError(errMsg);
    try {
      setLoading(true); setError("");
      const res = await axios.post(`${API}/verify-otp`, { email: form.email, otp: form.otp }, { withCredentials: true });
      localStorage.setItem("accessToken", res.data.accessToken);
      await handlePostLogin(res.data.accessToken);
    } catch (err) {
      setError(err.response?.data?.message || "OTP verification failed");
    } finally { setLoading(false); }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true); setError("");
      const res = await axios.post(`${API}/google`, { credential: credentialResponse.credential }, { withCredentials: true });
      localStorage.setItem("accessToken", res.data.accessToken);
      await handlePostLogin(res.data.accessToken);
    } catch {
      setError("Google login failed");
    } finally { setLoading(false); }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    try {
      setLoading(true); setError(""); setSuccess("");
      await axios.post(`${API}/resend-otp`, { email: form.email });
      setSuccess("OTP resent to your email!");
      startResendTimer();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (mode === "otp") startResendTimer();
  }, [mode]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls = "w-full bg-white border border-[var(--color-borderDark)] rounded-[8px] px-[13px] py-[10px] text-[13px] text-[var(--color-text)] font-[inherit] box-border focus:outline-2 focus:outline-[var(--color-accent)] focus:outline-offset-1 transition-all placeholder:text-[var(--color-faint)]";
  const btnCls   = "w-full py-[11px] rounded-[9px] border-none bg-[var(--color-accent)] text-white font-bold text-[13px] cursor-pointer font-[inherit] transition-opacity hover:opacity-90 disabled:opacity-50";

  const modeConfig = {
    login:    { title: "Welcome back",     sub: "Sign in to your account" },
    register: { title: "Create account",   sub: "Get started with Timerly" },
    otp:      { title: "Check your email", sub: `We sent a 6-digit code to ${form.email}` },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4 font-[var(--font-sans)]">
      <style>{`
        *{box-sizing:border-box;}
        input:focus{outline:2px solid var(--color-accent);outline-offset:1px;border-radius:8px;}
        .auth-card{animation:fadeUp .25s ease both;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div className="auth-card w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center text-2xl mx-auto mb-3 shadow-[var(--shadow-xl)]">⏳</div>
          <div className="font-bold text-[15px] text-[var(--color-text)]">Timerly</div>
          <div className="text-[11px] text-[var(--color-faint)] mt-0.5">All-in-one countdown generator</div>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-lg)] p-7">
          <div className="mb-5">
            <div className="font-bold text-[18px] text-[var(--color-text)] mb-1">{modeConfig[mode].title}</div>
            <div className="text-[12px] text-[var(--color-muted)] leading-[1.5]">{modeConfig[mode].sub}</div>
          </div>

          {error   && <div className="mb-4 px-3 py-2.5 rounded-[8px] bg-[var(--color-redBg)]   border border-[var(--color-redBdr)]   text-[var(--color-red)]   text-[12px] font-medium">⚠ {error}</div>}
          {success && <div className="mb-4 px-3 py-2.5 rounded-[8px] bg-[var(--color-greenBg)] border border-[var(--color-greenBdr)] text-[var(--color-green)] text-[12px] font-medium">✓ {success}</div>}

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-[0.05em] mb-1.5">Email</label>
              <input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} className={inputCls} disabled={mode === "otp"} />
            </div>

            {(mode === "login" || mode === "register") && (
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-[0.05em] mb-1.5">Password</label>
                <input name="password" type="password" placeholder="••••••••" value={form.password} onChange={handleChange} className={inputCls}
                  onKeyDown={(e) => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())} />
              </div>
            )}

            {mode === "otp" && (
              <>
                <input name="otp" type="text" placeholder="123456" maxLength={6} value={form.otp} onChange={handleChange}
                  className={`${inputCls} text-center text-[22px] font-bold tracking-[0.3em] font-mono`}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()} autoFocus />
                <button onClick={handleVerifyOtp} disabled={loading} className={btnCls}>
                  {loading ? "Verifying…" : "Verify OTP"}
                </button>
                <div className="text-[11px] mt-2 text-center">
                  Didn't receive code?{" "}
                  <span className={`text-[var(--color-accent)] cursor-pointer ${resendTimer > 0 ? "opacity-50 cursor-not-allowed" : ""}`} onClick={handleResendOtp}>
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend"}
                  </span>
                </div>
              </>
            )}

            {mode === "login"    && <button onClick={handleLogin}    disabled={loading} className={btnCls}>{loading ? "Signing in…"       : "Sign In"}</button>}
            {mode === "register" && <button onClick={handleRegister} disabled={loading} className={btnCls}>{loading ? "Creating account…" : "Create Account"}</button>}

            {mode !== "otp" && (
              <div className="text-[11px] text-center mt-2 text-[var(--color-faint)]">
                {mode === "login" ? "No account yet?" : "Already have an account?"}
                <span className="text-[var(--color-accent)] cursor-pointer ml-1" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                  {mode === "login" ? "Sign up" : "Sign in"}
                </span>
              </div>
            )}

            {mode !== "otp" && (
              <div className="mt-4">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google login failed")} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}