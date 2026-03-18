// src/pages/pricing.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PlanCards from "../components/Plancards";

const faqs = [
  { q: "Can I change plans later?",                 a: "Yes — upgrade or downgrade at any time. Changes take effect at the next billing cycle." },
  { q: "What happens to my timers if I downgrade?", a: "Existing timers stay live. If you exceed the plan limit, creation of new timers is paused until you're back within limits." },
  { q: "Is there a free trial on paid plans?",      a: "Yes — Pro comes with a 14-day free trial, no credit card required." },
  { q: "How does the Evergreen mode work?",          a: "Evergreen timers reset automatically after a set number of hours — great for recurring promotions." },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const navigate = useNavigate();

  const handleSelect = (plan) => {
    localStorage.setItem("pendingPlan", plan.name.toLowerCase());
    if (plan.stripePriceId) {
      localStorage.setItem("pendingPriceId",  plan.stripePriceId);
      localStorage.setItem("pendingInterval", "annual");
    } else {
      localStorage.removeItem("pendingPriceId");
      localStorage.removeItem("pendingInterval");
    }
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] font-[var(--font-sans)] text-[var(--color-text)]">

      {/* ── Nav ── */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-3 flex items-center justify-between shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center text-base shadow-[var(--shadow-xl)]">⏳</div>
          <span className="font-bold text-[14px]">Timerly</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/login")}
            className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-[var(--color-muted)] border border-[var(--color-border)] bg-transparent cursor-pointer font-[inherit] hover:border-[var(--color-borderDark)] transition-colors">
            Sign In
          </button>
          <button
            onClick={() => { localStorage.setItem("pendingPlan", "free"); localStorage.removeItem("pendingPriceId"); navigate("/login"); }}
            className="px-4 py-1.5 rounded-lg text-[12px] font-bold text-white bg-[var(--color-accent)] border-none cursor-pointer font-[inherit] shadow-[var(--shadow-md)]">
            Get Started Free
          </button>
        </div>
      </div>

      <div className="max-w-[1040px] mx-auto px-5 pb-24">

        {/* ── Hero ── */}
        <div className="text-center pt-14 pb-10">
          <div className="inline-flex items-center gap-1.5 bg-[var(--color-accentBg)] border border-[var(--color-accentBdr)] rounded-full px-3 py-1 text-[11px] font-bold text-[var(--color-accent)] uppercase tracking-[0.08em] mb-5">
            ✦ Simple, transparent pricing
          </div>
          <h1 className="text-[clamp(28px,4vw,44px)] font-bold tracking-tight leading-[1.1] mb-3">
            The right plan for every stage
          </h1>
          <p className="text-[14px] text-[var(--color-muted)] max-w-[420px] mx-auto leading-relaxed">
            Start free, upgrade when you're ready. All paid plans billed annually.
          </p>
        </div>

        {/* ── Plan Cards ── */}
        <PlanCards onSelect={handleSelect} />

        <p className="text-center text-[12px] text-[var(--color-faint)] mt-5">
          14-day free trial on Pro · No credit card required · Cancel anytime
        </p>

        {/* ── FAQ ── */}
        <div className="mt-16">
          <h2 className="text-[18px] font-bold text-center mb-1">Frequently asked questions</h2>
          <p className="text-[13px] text-[var(--color-muted)] text-center mb-7">
            Still have questions? <span className="text-[var(--color-accent)] cursor-pointer">Get in touch →</span>
          </p>
          <div className="flex flex-col gap-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left bg-transparent border-none cursor-pointer font-[inherit]">
                  <span className="text-[13px] font-semibold">{faq.q}</span>
                  <span className="text-[var(--color-muted)] text-[18px] leading-none ml-4 flex-shrink-0 transition-transform duration-200"
                    style={{ transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-[12px] text-[var(--color-muted)] leading-relaxed border-t border-[var(--color-border)]">
                    <div className="pt-3">{faq.a}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div className="mt-14 bg-[var(--color-accentBg)] border border-[var(--color-accentBdr)] rounded-2xl px-8 py-10 text-center shadow-[var(--shadow-md)]">
          <div className="text-[32px] mb-3">⏳</div>
          <h3 className="text-[18px] font-bold mb-2">Start building timers today</h3>
          <p className="text-[13px] text-[var(--color-muted)] mb-6 max-w-[360px] mx-auto">
            Join thousands of creators and businesses using Timerly to drive urgency and conversions.
          </p>
          <button
            onClick={() => { localStorage.setItem("pendingPlan", "free"); localStorage.removeItem("pendingPriceId"); navigate("/login"); }}
            className="bg-[var(--color-accent)] text-white border-none rounded-[10px] px-8 py-3 text-[13px] font-bold cursor-pointer font-[inherit] shadow-[var(--shadow-xl)] hover:opacity-90 transition-opacity">
            Get Started Free →
          </button>
        </div>
      </div>
    </div>
  );
}