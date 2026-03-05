/**
 * theme.js — Single source of truth for all design tokens.
 *
 * Usage:
 *   import { injectTheme } from "./theme";
 *   injectTheme(); // call once at app root (e.g. in main.jsx or App.jsx)
 *
 * Then use in Tailwind via CSS variable arbitrary values:
 *   className="bg-[var(--color-bg)] text-[var(--color-text)]"
 *
 * Or import TOKEN constants for the rare cases that need JS values
 * (e.g. dynamic `style` props for canvas/svg/third-party libs).
 */

// ─── Color Palette ────────────────────────────────────────────────────────────
export const COLORS = {
  // Layout
  bg:          "#f1f5f9",
  panel:       "#ffffff",
  card:        "#f8fafc",
  border:      "#e2e8f0",
  borderDark:  "#cbd5e1",

  // Text
  text:        "#0f172a",
  mid:         "#334155",
  muted:       "#64748b",
  faint:       "#94a3b8",

  // Brand / Accent
  accent:      "#4f46e5",
  accentBg:    "#eef2ff",
  accentBdr:   "#c7d2fe",

  // Semantic: Success / Green
  green:       "#15803d",
  greenBg:     "#f0fdf4",
  greenBdr:    "#bbf7d0",

  // Semantic: Warning / Amber
  amber:       "#92400e",
  amberBg:     "#fffbeb",
  amberBdr:    "#fde68a",

  // Semantic: Info / Blue
  blue:        "#1e40af",
  blueBg:      "#eff6ff",
  blueBdr:     "#bfdbfe",

  // Semantic: Danger / Red
  red:         "#dc2626",
  redBg:       "#fef2f2",
  redBdr:      "#fecaca",

  // Semantic: Purple
  purple:      "#7c3aed",
  purpleBg:    "#f5f3ff",
  purpleBdr:   "#ddd6fe",

  // Code block
  codeBg:      "#1e1e2e",
  codeText:    "#a6e3a1",
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const TYPOGRAPHY = {
  /** UI / body font stack */
  fontSans:  "system-ui, 'Segoe UI', sans-serif",
  /** Monospace / code font stack */
  fontMono:  "monospace",

  /**
   * Timer display font options (loaded via Google Fonts or your bundler).
   * The first entry is the default.
   */
  timerFonts: [
    "Orbitron",
    "Space Mono",
    "Oswald",
    "Bebas Neue",
    "Rajdhani",
    "Share Tech Mono",
    "DM Serif Display",
    "Playfair Display",
  ],

  /** Base font sizes (px) */
  size: {
    xs:   9,
    sm:   10,
    base: 11,
    md:   12,
    lg:   13,
    xl:   14,
    "2xl": 16,
    "3xl": 18,
    "4xl": 22,
    "5xl": 32,
  },

  /** Font weights */
  weight: {
    normal:    400,
    medium:    500,
    semibold:  600,
    bold:      700,
  },

  /** Letter spacings */
  tracking: {
    tight:  "0.03em",
    normal: "0.05em",
    wide:   "0.1em",
    wider:  "0.14em",
    widest: "0.18em",
    caps:   "0.25em",
  },
};

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const SPACING = {
  /** Common padding values in px */
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 32,
};

// ─── Border Radius ────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   4,
  md:   7,
  lg:   8,
  xl:   10,
  "2xl": 12,
  "3xl": 14,
  full: 9999,
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const SHADOWS = {
  sm:    "0 1px 3px rgba(0,0,0,.05)",
  md:    "0 1px 4px rgba(0,0,0,.06)",
  lg:    "0 4px 16px rgba(0,0,0,.10)",
  xl:    "0 4px 24px rgba(79,70,229,.13)",
  popup: "0 8px 40px rgba(0,0,0,.2)",
};

// ─── Timer Preset Templates ───────────────────────────────────────────────────
export const TIMER_TEMPLATES = [
  { name: "Dark Pro", bg: "#0f0f1a", box: "#1e1b4b", text: "#e0e7ff", accent: "#818cf8" },
  { name: "Fire",     bg: "#1c0a00", box: "#7f1d1d", text: "#fef2f2", accent: "#f97316" },
  { name: "Ocean",    bg: "#0c1a2e", box: "#0c4a6e", text: "#e0f2fe", accent: "#38bdf8" },
  { name: "Forest",   bg: "#052e16", box: "#14532d", text: "#dcfce7", accent: "#4ade80" },
  { name: "Gold",     bg: "#1c1400", box: "#451a03", text: "#fef9c3", accent: "#facc15" },
  { name: "Rose",     bg: "#1a000f", box: "#4c0519", text: "#ffe4e6", accent: "#fb7185" },
];

// ─── Timezone Options ─────────────────────────────────────────────────────────
export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

// ─── Default Timer Config ─────────────────────────────────────────────────────
export const DEFAULT_TIMER_CFG = {
  bg:          TIMER_TEMPLATES[0].bg,
  box:         TIMER_TEMPLATES[0].box,
  text:        TIMER_TEMPLATES[0].text,
  accent:      TIMER_TEMPLATES[0].accent,
  font:        TYPOGRAPHY.timerFonts[0],   // "Orbitron"
  title:       "OFFER ENDS IN",
  showDays:    true,
  showHours:   true,
  showMinutes: true,
  showSeconds: true,
  transparent: false,
  borderRadius: RADIUS["2xl"],             // 12
  fontSize:    36,
};

// ─── CSS Variable Injection ───────────────────────────────────────────────────
/**
 * Call injectTheme() once at your app's entry point.
 * This writes every color token as a CSS custom property on :root,
 * making them available to Tailwind arbitrary values and plain CSS alike.
 *
 * Example output on <html>:
 *   --color-bg: #f1f5f9;
 *   --color-accent: #4f46e5;
 *   ...
 */
export function injectTheme() {
  const root = document.documentElement;

  // Colors → --color-*
  Object.entries(COLORS).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });

  // Font families → --font-sans, --font-mono
  root.style.setProperty("--font-sans", TYPOGRAPHY.fontSans);
  root.style.setProperty("--font-mono", TYPOGRAPHY.fontMono);

  // Shadows → --shadow-*
  Object.entries(SHADOWS).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });
}

/**
 * Convenience: returns a plain-object style block for components
 * that still need a JS `style` prop (e.g. canvas-driven or SVG).
 * Use sparingly — prefer Tailwind classes where possible.
 */
export function cssVar(name) {
  return `var(--color-${name})`;
}