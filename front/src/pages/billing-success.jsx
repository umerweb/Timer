// src/pages/billing-success.jsx
// NEW FILE — Stripe redirects here after successful payment
// URL will be: /billing/success?session_id=cs_xxx

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

const BILLING_API = import.meta.env.VITE_BACKEND_URL + "/api/billing";

export default function BillingSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [plan,   setPlan]   = useState("");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const token     = localStorage.getItem("accessToken");

    if (!sessionId || !token) {
      navigate("/dashboard");
      return;
    }

    axios.post(
      `${BILLING_API}/confirm-checkout`,
      { sessionId },
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then(res => {
        if (res.data.plan) {
          setPlan(res.data.plan);
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  // Auto-redirect to dashboard after success
  useEffect(() => {
    if (status === "success") {
      const t = setTimeout(() => navigate("/dashboard"), 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center font-[var(--font-sans)] px-4">
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-lg)] p-10 max-w-[400px] w-full text-center">

        {status === "verifying" && (
          <>
            <div className="text-[40px] mb-4">⏳</div>
            <div className="font-bold text-[16px] text-[var(--color-text)] mb-2">Confirming your payment…</div>
            <div className="text-[13px] text-[var(--color-muted)]">Just a moment.</div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-[40px] mb-4">🎉</div>
            <div className="font-bold text-[18px] text-[var(--color-text)] mb-2">You're all set!</div>
            <div className="text-[13px] text-[var(--color-muted)] mb-6">
              Your <strong className="capitalize text-[var(--color-text)]">{plan}</strong> plan is now active. Redirecting you to the dashboard…
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-[var(--color-accent)] text-white border-none rounded-[10px] px-6 py-2.5 text-[13px] font-bold cursor-pointer font-[inherit] w-full hover:opacity-90 transition-opacity"
            >
              Go to Dashboard →
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-[40px] mb-4">⚠️</div>
            <div className="font-bold text-[16px] text-[var(--color-text)] mb-2">Something went wrong</div>
            <div className="text-[13px] text-[var(--color-muted)] mb-6">
              We couldn't confirm your payment. If you were charged, please contact support — your plan will be activated shortly.
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-[var(--color-accent)] text-white border-none rounded-[10px] px-6 py-2.5 text-[13px] font-bold cursor-pointer font-[inherit] w-full hover:opacity-90 transition-opacity"
            >
              Go to Dashboard
            </button>
          </>
        )}

      </div>
    </div>
  );
}