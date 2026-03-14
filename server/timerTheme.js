/**
 * timerTheme.js — single source of truth for all timer config.
 *
 * Used by:
 *   - server/routes/timer.js  (GIF canvas + embed HTML)
 *   - GET /api/timer/theme    (served to frontend on app load)
 *
 * FONTS: canvas registerFont() paths assume fonts live in server/fonts/
 *   Orbitron-Bold.ttf
 *   SpaceMono-Bold.ttf
 *   Oswald-Bold.ttf
 *
 * STYLE RULE: NO box-shadow, NO text-shadow, NO blur, NO glow.
 * Canvas cannot render those. Only: fills, strokes, border-radius, gradients,
 * flat colour offsets.
 */

// ─── Defaults ────────────────────────────────────────────────────────────────
const TIMER_DEFAULTS = {
  bg:           "#0f0f1a",
  box:          "#1e1b4b",
  text:         "#e0e7ff",
  accent:       "#818cf8",
  title:        "",
  font:         "Orbitron",
  fontSize:     36,
  labelSize:    11,
  borderRadius: 12,
  showDays:     true,
  showHours:    true,
  showMinutes:  true,
  showSeconds:  true,
  visualStyle:  "flat",
  width:        500,
  height:       130,
};

// ─── Colour theme presets ─────────────────────────────────────────────────────
const TIMER_TEMPLATES = [
  { name: "Dark Pro", bg: "#0f0f1a", box: "#1e1b4b", text: "#e0e7ff", accent: "#818cf8" },
  { name: "Fire",     bg: "#1c0a00", box: "#7f1d1d", text: "#fef2f2", accent: "#f97316" },
  { name: "Ocean",    bg: "#0c1a2e", box: "#0c4a6e", text: "#e0f2fe", accent: "#38bdf8" },
  { name: "Forest",   bg: "#052e16", box: "#14532d", text: "#dcfce7", accent: "#4ade80" },
  { name: "Gold",     bg: "#1c1400", box: "#451a03", text: "#fef9c3", accent: "#facc15" },
  { name: "Rose",     bg: "#1a000f", box: "#4c0519", text: "#ffe4e6", accent: "#fb7185" },
];

// ─── Timezones ────────────────────────────────────────────────────────────────
const TIMEZONES = [
  "UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Karachi",
  "Asia/Kolkata","Asia/Tokyo","Asia/Shanghai","Australia/Sydney","Pacific/Auckland",
];

// ─── Fonts available in the editor ───────────────────────────────────────────
// Each entry: { name, label, file }
//   name  — value stored in cfg.font, used in CSS font-family
//   label — display name in the editor dropdown
//   file  — filename in server/fonts/ for canvas registerFont()
const TIMER_FONTS = [
  { name: "Orbitron",   label: "Orbitron",    file: "Orbitron-Bold.ttf"   },
  { name: "SpaceMono", label: "Space Mono",  file: "SpaceMono-Bold.ttf"  },
  { name: "Oswald",     label: "Oswald",      file: "Oswald-Bold.ttf"     },
];

// ─── Style names ──────────────────────────────────────────────────────────────
const STYLE_NAMES = {
  flat:    "Flat",
  outline: "Outline",
  split:   "Split",
  pill:    "Pill",
  minimal: "Minimal",
  retro:   "Retro",
};

// ─── roundRect ────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  if (r <= 0) { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.closePath(); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

// ─── STYLE_DEFS ───────────────────────────────────────────────────────────────
const STYLE_DEFS = {

  // 1. FLAT — solid blocks, zero borders, zero radius
  flat: {
    embedCss: (p) => ({
      wrap:  ``,
      box:   `border-radius:0; border:none; background:${p.box};`,
      sep:   `opacity:.5;`,
      label: `opacity:.5; letter-spacing:.15em;`,
    }),
    canvas: {
      drawWrapper(ctx, W, H, p) {
        ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      },
      drawBox(ctx, x, y, bW, bH, _br, p) {
        ctx.fillStyle = p.box; ctx.fillRect(x, y, bW, bH);
      },
      numberColor: (p) => p.textColor,
      labelColor:  (p) => p.textColor, labelAlpha: 0.5,
      sepColor:    (p) => p.accent,    sepAlpha:   0.5,
      boxRadius:   0,
    },
  },

  // 2. OUTLINE — transparent boxes, accent stroke only
  outline: {
    embedCss: (p) => ({
      wrap:  ``,
      box:   `border-radius:${p.borderRadius}px; border:2px solid ${p.accent}; background:transparent;`,
      sep:   `color:${p.accent}; opacity:.7;`,
      label: `color:${p.accent}; opacity:.7; letter-spacing:.12em;`,
    }),
    canvas: {
      drawWrapper(ctx, W, H, p) {
        ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      },
      drawBox(ctx, x, y, bW, bH, br, p) {
        ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
        roundRect(ctx, x, y, bW, bH, br); ctx.stroke();
      },
      numberColor: (p) => p.textColor,
      labelColor:  (p) => p.accent,    labelAlpha: 0.7,
      sepColor:    (p) => p.accent,    sepAlpha:   0.7,
    },
  },

  // 3. SPLIT — accent band at bottom holds the label
  split: {
    embedCss: (p) => ({
      wrap:  ``,
      box:   `border-radius:${p.borderRadius}px; border:none; background:${p.box}; overflow:hidden; padding:0; display:flex; flex-direction:column;`,
      sep:   `opacity:.6;`,
      label: `background:${p.accent}; color:${p.bg}; opacity:1; margin-top:0; padding:2px 0; letter-spacing:.12em; width:100%; text-align:center;`,
    }),
    canvas: {
      drawWrapper(ctx, W, H, p) {
        ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      },
      drawBox(ctx, x, y, bW, bH, br, p) {
        ctx.fillStyle = p.box;
        roundRect(ctx, x, y, bW, bH, br); ctx.fill();
        const bandH = Math.round(bH * 0.28);
        ctx.fillStyle = p.accent;
        ctx.fillRect(x, y + bH - bandH, bW, bandH);
      },
      numberColor: (p) => p.textColor,
      labelColor:  (p) => p.bg,        labelAlpha: 1,
      sepColor:    (p) => p.accent,    sepAlpha:   0.6,
    },
  },

  // 4. PILL — fully rounded gradient boxes
  pill: {
    embedCss: (p) => ({
      wrap:  ``,
      box:   `border-radius:999px; border:none; background:linear-gradient(135deg,${p.box},${p.accent}44); font-weight:800; padding-left:clamp(14px,3vw,22px); padding-right:clamp(14px,3vw,22px);`,
      sep:   `opacity:.4; font-weight:300;`,
      label: `color:${p.accent}; opacity:.85; font-weight:600; letter-spacing:.15em;`,
    }),
    canvas: {
      drawWrapper(ctx, W, H, p) {
        ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      },
      drawBox(ctx, x, y, bW, bH, _br, p) {
        const br = bH / 2;
        const grad = ctx.createLinearGradient(x, y, x + bW, y + bH);
        grad.addColorStop(0, p.box);
        grad.addColorStop(1, p.accent + "66");
        ctx.fillStyle = grad;
        roundRect(ctx, x, y, bW, bH, br); ctx.fill();
      },
      numberColor: (p) => p.textColor,
      labelColor:  (p) => p.accent,    labelAlpha: 0.85,
      sepColor:    (p) => p.accent,    sepAlpha:   0.4,
      boxRadius:   999,
    },
  },

  // 5. MINIMAL — underline only beneath each number
  minimal: {
    embedCss: (p) => ({
      wrap:  ``,
      box:   `background:transparent; border:none; border-radius:0; border-bottom:2px solid ${p.accent}; padding-bottom:6px;`,
      sep:   `opacity:.25; font-weight:300;`,
      label: `opacity:.45; letter-spacing:.2em; font-weight:400;`,
    }),
    canvas: {
      drawWrapper(ctx, W, H, p) {
        ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
      },
      drawBox(ctx, x, y, bW, bH, _br, p) {
        ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y + bH); ctx.lineTo(x + bW, y + bH); ctx.stroke();
      },
      numberColor: (p) => p.textColor,
      labelColor:  (p) => p.textColor, labelAlpha: 0.45,
      sepColor:    (p) => p.accent,    sepAlpha:   0.25,
      boxRadius:   0,
    },
  },

  // 6. RETRO — thick border + flat offset. 8-bit feel.
  retro: {
    embedCss: (p) => ({
      wrap:  `border:4px solid ${p.accent}; box-shadow:6px 6px 0 ${p.accent}; border-radius:0;`,
      box:   `border-radius:0; border:3px solid ${p.accent}; box-shadow:3px 3px 0 ${p.accent}88; font-weight:900;`,
      sep:   `opacity:1; font-weight:900;`,
      label: `opacity:1; font-weight:700; letter-spacing:.12em; color:${p.accent};`,
    }),
    canvas: {
      drawWrapper(ctx, W, H, p) {
        ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = p.accent; ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, W - 8, H - 8);
        ctx.strokeStyle = p.accent + "88"; ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, W - 8, H - 8);
      },
      drawBox(ctx, x, y, bW, bH, _br, p) {
        ctx.fillStyle = p.accent + "88"; ctx.fillRect(x + 3, y + 3, bW, bH);
        ctx.fillStyle = p.box;           ctx.fillRect(x, y, bW, bH);
        ctx.strokeStyle = p.accent; ctx.lineWidth = 3;
        ctx.strokeRect(x, y, bW, bH);
      },
      numberColor: (p) => p.textColor,
      labelColor:  (p) => p.accent, labelAlpha: 1,
      sepColor:    (p) => p.accent, sepAlpha:   1,
      boxRadius:   0,
    },
  },

};

module.exports = { TIMER_DEFAULTS, TIMER_TEMPLATES, TIMEZONES, TIMER_FONTS, STYLE_NAMES, STYLE_DEFS, roundRect };