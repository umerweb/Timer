// src/pages/select-plan.jsx
// NEW FILE — shown to new users who haven't picked a plan yet
// Also handles Stripe checkout redirect for paid plans

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PlanCards from "../components/Plancards";

const BILLING_API = import.meta.env.VITE_BACKEND_URL + "/api/billing";

export default function SelectPlanPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const token = localStorage.getItem("accessToken");

  // If no token at all, send back to login
  useEffect(() => {
    if (!token) navigate("/login");
  }, []);

  // If user already has a pending paid plan from pricing page,
  // kick off Stripe checkout automatically without showing the UI
  useEffect(() => {
    const pendingPlan    = localStorage.getItem("pendingPlan");
    const pendingPriceId = localStorage.getItem("pendingPriceId");

    if (pendingPlan && pendingPlan !== "free" && pendingPriceId) {
      startCheckout(pendingPlan, pendingPriceId);
    }
  }, []);

  const startCheckout = async (planId, priceId) => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(
        `${BILLING_API}/create-checkout`,
        { planId, priceId, interval: "annual" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { url } = res.data;
      if (!url) throw new Error("No checkout URL returned");

      // Clear localStorage before leaving
      localStorage.removeItem("pendingPlan");
      localStorage.removeItem("pendingPriceId");
      localStorage.removeItem("pendingInterval");

      // Redirect to Stripe
      window.location.href = url;
    } catch (err) {
      setError("Could not start checkout. Please try again.");
      setLoading(false);
    }
  };

  // Called when user picks a plan on this page
  const handleSelect = async (plan) => {
    if (!plan.stripePriceId) {
      // Free plan selected
      setLoading(true);
      try {
        await axios.post(`${BILLING_API}/set-free`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        localStorage.removeItem("pendingPlan");
        localStorage.removeItem("pendingPriceId");
        localStorage.removeItem("pendingInterval");
        navigate("/dashboard");
      } catch {
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
      return;
    }

    // Paid plan
    await startCheckout(plan.name.toLowerCase(), plan.stripePriceId);
  };

  // ── Loading state (auto-redirecting to Stripe) ──────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center font-[var(--font-sans)]">
        <div className="text-center">
          <div className="text-[40px] mb-4">⏳</div>
          <div className="font-bold text-[15px] text-[var(--color-text)] mb-2">Setting up your plan…</div>
          <div className="text-[13px] text-[var(--color-muted)]">You'll be redirected to checkout shortly.</div>
        </div>
      </div>
    );
  }

  // ── Plan picker UI (shown when no pendingPlan or on error) ──────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)] font-[var(--font-sans)] text-[var(--color-text)]">

      {/* Nav */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-3 flex items-center justify-between shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center text-base">⏳</div>
          <span className="font-bold text-[14px]">Timerly</span>
        </div>
      </div>

      <div className="max-w-[1040px] mx-auto px-5 py-12">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[24px] font-bold tracking-tight mb-2">Choose your plan</h1>
          <p className="text-[13px] text-[var(--color-muted)]">
            Pick the plan that works for you. You can upgrade anytime.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 px-4 py-3 rounded-xl bg-[var(--color-redBg)] border border-[var(--color-redBdr)] text-[var(--color-red)] text-[13px] font-medium text-center">
            ⚠ {error}
          </div>
        )}

        {/* Plan cards */}
        <PlanCards onSelect={handleSelect} />

        <p className="text-center text-[12px] text-[var(--color-faint)] mt-5">
          14-day free trial on Pro · No credit card required · Cancel anytime
        </p>
      </div>
    </div>
  );
}