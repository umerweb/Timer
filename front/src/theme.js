// App UI colours — editor chrome, sidebar, buttons, alerts.
// Timer-specific config (templates, defaults, styles) lives in server/timerTheme.js
// and is fetched into window.__TIMER_THEME__ at boot by main.jsx.

export const COLORS = {
  bg:         "#f1f5f9",
  panel:      "#ffffff",
  card:       "#f8fafc",
  border:     "#e2e8f0",
  borderDark: "#cbd5e1",
  text:       "#0f172a",
  mid:        "#334155",
  muted:      "#64748b",
  faint:      "#94a3b8",
  accent:     "#4f46e5",
  accentBg:   "#eef2ff",
  accentBdr:  "#c7d2fe",
  green:      "#15803d",
  greenBg:    "#f0fdf4",
  greenBdr:   "#bbf7d0",
  amber:      "#92400e",
  amberBg:    "#fffbeb",
  amberBdr:   "#fde68a",
  blue:       "#1e40af",
  blueBg:     "#eff6ff",
  blueBdr:    "#bfdbfe",
  red:        "#dc2626",
  redBg:      "#fef2f2",
  redBdr:     "#fecaca",
  purple:     "#7c3aed",
  purpleBg:   "#f5f3ff",
  purpleBdr:  "#ddd6fe",
  codeBg:     "#1e1e2e",
  codeText:   "#a6e3a1",
};

export const SHADOWS = {
  sm:    "0 1px 3px rgba(0,0,0,.05)",
  md:    "0 1px 4px rgba(0,0,0,.06)",
  lg:    "0 4px 16px rgba(0,0,0,.10)",
  xl:    "0 4px 24px rgba(79,70,229,.13)",
  popup: "0 8px 40px rgba(0,0,0,.2)",
};

const TYPOGRAPHY = {
  fontSans: "system-ui, 'Segoe UI', sans-serif",
  fontMono: "monospace",
};

export function injectTheme() {
  const root = document.documentElement;
  Object.entries(COLORS).forEach(([k, v])  => root.style.setProperty(`--color-${k}`, v));
  Object.entries(SHADOWS).forEach(([k, v]) => root.style.setProperty(`--shadow-${k}`, v));
  root.style.setProperty("--font-sans", TYPOGRAPHY.fontSans);
  root.style.setProperty("--font-mono", TYPOGRAPHY.fontMono);
}

export function cssVar(name) { return `var(--color-${name})`; }