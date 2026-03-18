// src/components/PlanCards.jsx
// Drop this in src/components/PlanCards.jsx
// Used by pricing.jsx (public) and select-plan.jsx (post-login new users)

export const PLANS = [
  {
    name: "Free",
    stripePriceId: null,
    tag: "Always free",
    price: 0,
    accentColor: "var(--color-muted)",
    accentBg: "var(--color-card)",
    accentBdr: "var(--color-border)",
    highlight: false,
    features: [
      "3 active timers",
      "Countdown mode only",
      "Basic embed support",
      "Standard templates",
    ],
  },
  {
    name: "Starter",
    stripePriceId: "price_1TCLQE7dXP4cTTbz7pUje5Kc",
    tag: "Perfect for getting started",
    price: 7,
    accentColor: "var(--color-accent)",
    accentBg: "var(--color-accentBg)",
    accentBdr: "var(--color-accentBdr)",
    highlight: false,
    features: [
      "5 active timers",
      "Countdown & Count-up modes",
      "Basic embed support",
      "Standard templates",
      "Email support",
    ],
  },
  {
    name: "Pro",
    stripePriceId: "price_1TCLQd7dXP4cTTbzOaw0qUWl",
    tag: "Most popular",
    price: 15,
    accentColor: "var(--color-purple)",
    accentBg: "var(--color-purpleBg)",
    accentBdr: "var(--color-purpleBdr)",
    highlight: true,
    features: [
      "Unlimited active timers",
      "All timer modes incl. Evergreen",
      "Custom branding & fonts",
      "Priority embed CDN",
      "Analytics & view tracking",
      "Priority support",
    ],
  },
  {
    name: "Teams",
    stripePriceId: "price_1TCLR27dXP4cTTbztwQURkkI",
    tag: "For agencies & power users",
    price: 39,
    accentColor: "var(--color-green)",
    accentBg: "var(--color-greenBg)",
    accentBdr: "var(--color-greenBdr)",
    highlight: false,
    features: [
      "Everything in Pro",
      "5 team members",
      "White-label embeds",
      "API access",
      "Custom domain support",
      "Dedicated account manager",
    ],
  },
];

// Reusable grid of plan cards
// onSelect(plan) — called when user clicks a card
export default function PlanCards({ onSelect }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {PLANS.map((plan) => (
        <div
          key={plan.name}
          className="relative bg-[var(--color-panel)] rounded-2xl flex flex-col transition-shadow duration-150 hover:shadow-[var(--shadow-lg)]"
          style={{
            border: plan.highlight ? "2px solid var(--color-accentBdr)" : "1px solid var(--color-border)",
            boxShadow: plan.highlight ? "var(--shadow-xl)" : "var(--shadow-md)",
          }}
        >
          {plan.highlight && (
            <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 bg-[var(--color-accent)] text-white text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full whitespace-nowrap shadow-[var(--shadow-md)]">
              ⭐ Most Popular
            </div>
          )}

          <div className="p-6 flex flex-col flex-1">
            <div className="mb-5">
              <div
                className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border mb-3"
                style={{ color: plan.accentColor, background: plan.accentBg, borderColor: plan.accentBdr }}
              >
                {plan.tag}
              </div>
              <div className="text-[17px] font-bold text-[var(--color-text)] mb-1">{plan.name}</div>
              <div className="flex items-end gap-1">
                {plan.price === 0 ? (
                  <span className="text-[40px] font-bold text-[var(--color-text)] leading-none tracking-tight">Free</span>
                ) : (
                  <>
                    <span className="text-[40px] font-bold text-[var(--color-text)] leading-none tracking-tight">${plan.price}</span>
                    <span className="text-[12px] text-[var(--color-muted)] pb-1.5">/mo</span>
                  </>
                )}
              </div>
              {plan.price > 0 && (
                <div className="text-[11px] text-[var(--color-faint)] mt-1">Billed annually</div>
              )}
            </div>

            <div className="h-px bg-[var(--color-border)] mb-5" />

            <ul className="flex flex-col gap-2.5 mb-auto">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] text-[var(--color-mid)] leading-snug">
                  <span
                    className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-[1px] text-[9px] font-black border"
                    style={{ color: plan.accentColor, background: plan.accentBg, borderColor: plan.accentBdr }}
                  >✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => onSelect(plan)}
              className="mt-6 w-full py-2.5 rounded-[10px] text-[13px] font-bold cursor-pointer font-[inherit] transition-opacity hover:opacity-90 border"
              style={
                plan.highlight
                  ? { background: "var(--color-accent)", color: "#fff", border: "none", boxShadow: "var(--shadow-xl)" }
                  : { background: plan.accentBg, color: plan.accentColor, borderColor: plan.accentBdr }
              }
            >
              Get Started →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}