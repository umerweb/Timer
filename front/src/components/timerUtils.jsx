import { useState, useEffect, useCallback, memo } from "react";
import {
  COLORS,
  TYPOGRAPHY,
  TIMER_TEMPLATES,
  TIMEZONES,
  DEFAULT_TIMER_CFG,
  cssVar,
} from "../theme";

// ─── Timer helpers ────────────────────────────────────────────────────────────
export function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function calcTime(target, mode, countUp, egHours) {
  if (mode === "evergreen") {
    const h = egHours;
    return { days: Math.floor(h / 24), hours: h % 24, minutes: 0, seconds: 0, done: false };
  }
  let diff = new Date(target) - new Date();
  if (countUp) diff = -diff;
  if (diff < 0) diff = 0;
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    done:    diff === 0,
  };
}

export function buildParams(cfg, target, mode, egHours, timezone) {
  return new URLSearchParams({
    target, mode, egHours, timezone,
    countUp: mode === "countup" ? "1" : "0",
    bg:           cfg.bg.replace("#", ""),
    box:          cfg.box.replace("#", ""),
    text:         cfg.text.replace("#", ""),
    accent:       cfg.accent.replace("#", ""),
    title:        cfg.title,
    fontSize:     cfg.fontSize,
    borderRadius: cfg.borderRadius,
    transparent:  cfg.transparent ? "1" : "0",
    days:         cfg.showDays    ? "1" : "0",
    hours:        cfg.showHours   ? "1" : "0",
    minutes:      cfg.showMinutes ? "1" : "0",
    seconds:      cfg.showSeconds ? "1" : "0",
  }).toString();
}

export function defaultTarget() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// ─── Visual Style Presets ─────────────────────────────────────────────────────
// Each preset overrides only the CSS properties it cares about.
// TimerFace merges these on top of the base styles — no HTML changes needed.
//
// Surfaces you can override per-element:
//   wrapper  → the outer container div
//   box      → each number box
//   label    → DAYS / HRS / MIN / SEC text
//   sep      → the ":" separator
//   title    → the title row above numbers
//
export const VISUAL_STYLES = {

  // 1. Default — flat dark boxes, subtle glow border (the existing look)
  default: {
    label: "Default",
    wrapper: (s, cfg) => ({
      border: `${2*s}px solid ${cfg.accent}44`,
      boxShadow: `0 ${4*s}px ${20*s}px ${cfg.accent}18`,
      borderRadius: `${(cfg.borderRadius||12)*s}px`,
    }),
    box: (s, cfg) => ({
      borderRadius: `${7*s}px`,
      border: `1px solid ${cfg.accent}30`,
      boxShadow: `0 ${2*s}px ${8*s}px rgba(0,0,0,.25)`,
      background: cfg.box,
    }),
    sep: () => ({}),
    label: () => ({}),
    title: () => ({}),
  },

  // 2. Neon — bright glowing outlines, no fill on boxes, electric vibe
  neon: {
    label: "Neon",
    wrapper: (s, cfg) => ({
      border: `${2*s}px solid ${cfg.accent}`,
      boxShadow: `0 0 ${18*s}px ${cfg.accent}99, 0 0 ${36*s}px ${cfg.accent}44, inset 0 0 ${12*s}px ${cfg.accent}11`,
      borderRadius: `${(cfg.borderRadius||12)*s}px`,
    }),
    box: (s, cfg) => ({
      borderRadius: `${4*s}px`,
      border: `${2*s}px solid ${cfg.accent}`,
      boxShadow: `0 0 ${10*s}px ${cfg.accent}88, inset 0 0 ${8*s}px ${cfg.accent}22`,
      background: `${cfg.accent}11`,
      color: cfg.accent,
    }),
    sep: (s, cfg) => ({
      color: cfg.accent,
      textShadow: `0 0 ${8*s}px ${cfg.accent}`,
      opacity: 1,
    }),
    label: (s, cfg) => ({
      color: cfg.accent,
      opacity: 0.85,
      textShadow: `0 0 ${6*s}px ${cfg.accent}88`,
      letterSpacing: "0.2em",
    }),
    title: (s, cfg) => ({
      color: cfg.accent,
      textShadow: `0 0 ${10*s}px ${cfg.accent}`,
      letterSpacing: "0.25em",
    }),
  },

  // 3. Minimal — no box background, just a bottom border underline, clean whitespace
  minimal: {
    label: "Minimal",
    wrapper: (s, cfg) => ({
      border: "none",
      boxShadow: "none",
      borderRadius: 0,
      borderBottom: `${2*s}px solid ${cfg.accent}55`,
      paddingBottom: `${14*s}px`,
    }),
    box: (s, cfg) => ({
      background: "transparent",
      border: "none",
      boxShadow: "none",
      borderRadius: 0,
      borderBottom: `${2*s}px solid ${cfg.accent}`,
      color: cfg.text,
      paddingLeft: `${8*s}px`,
      paddingRight: `${8*s}px`,
    }),
    sep: (s, cfg) => ({
      color: cfg.accent,
      opacity: 0.35,
      fontWeight: 300,
    }),
    label: (s, cfg) => ({
      color: cfg.text,
      opacity: 0.4,
      letterSpacing: "0.22em",
      fontWeight: 400,
      textTransform: "uppercase",
    }),
    title: (s, cfg) => ({
      letterSpacing: "0.3em",
      fontWeight: 400,
      opacity: 0.65,
    }),
  },

  // 4. Glass — frosted translucent boxes with backdrop blur vibe, soft borders
  glass: {
    label: "Glass",
    wrapper: (s, cfg) => ({
      border: `${1*s}px solid ${cfg.text}18`,
      boxShadow: `0 ${8*s}px ${32*s}px rgba(0,0,0,.35), inset 0 ${1*s}px 0 ${cfg.text}22`,
      borderRadius: `${(cfg.borderRadius||12)*s}px`,
      background: `${cfg.bg}cc`,
    }),
    box: (s, cfg) => ({
      borderRadius: `${10*s}px`,
      border: `${1*s}px solid ${cfg.text}22`,
      boxShadow: `inset 0 ${1*s}px 0 ${cfg.text}15, 0 ${4*s}px ${12*s}px rgba(0,0,0,.2)`,
      background: `${cfg.text}0d`,
      color: cfg.text,
    }),
    sep: (s, cfg) => ({
      color: cfg.text,
      opacity: 0.25,
      fontWeight: 300,
    }),
    label: (s, cfg) => ({
      color: cfg.text,
      opacity: 0.45,
      letterSpacing: "0.18em",
      fontWeight: 500,
    }),
    title: (s, cfg) => ({
      opacity: 0.75,
      letterSpacing: "0.22em",
      fontWeight: 600,
    }),
  },

  // 5. Retro — thick solid borders, flat color, no shadows, chunky 8-bit feel
  retro: {
    label: "Retro",
    wrapper: (s, cfg) => ({
      border: `${4*s}px solid ${cfg.accent}`,
      boxShadow: `${6*s}px ${6*s}px 0 ${cfg.accent}`,
      borderRadius: 0,
    }),
    box: (s, cfg) => ({
      borderRadius: 0,
      border: `${3*s}px solid ${cfg.accent}`,
      boxShadow: `${3*s}px ${3*s}px 0 ${cfg.accent}88`,
      background: cfg.box,
      color: cfg.text,
      fontWeight: 900,
      letterSpacing: "0.05em",
    }),
    sep: (s, cfg) => ({
      color: cfg.accent,
      opacity: 1,
      fontWeight: 900,
      fontSize: "inherit",
    }),
    label: (s, cfg) => ({
      color: cfg.accent,
      opacity: 1,
      fontWeight: 700,
      letterSpacing: "0.12em",
    }),
    title: (s, cfg) => ({
      color: cfg.accent,
      letterSpacing: "0.15em",
      fontWeight: 900,
    }),
  },

  // 6. Soft — rounded pill boxes, pastel glow, friendly & modern
  soft: {
    label: "Soft",
    wrapper: (s, cfg) => ({
      border: `${1*s}px solid ${cfg.accent}33`,
      boxShadow: `0 ${2*s}px ${24*s}px ${cfg.accent}22`,
      borderRadius: `${28*s}px`,
      padding: `${22*s}px ${28*s}px`,
    }),
    box: (s, cfg) => ({
      borderRadius: `${999*s}px`,
      border: "none",
      boxShadow: `0 ${4*s}px ${16*s}px ${cfg.accent}33`,
      background: `linear-gradient(135deg, ${cfg.box}, ${cfg.accent}44)`,
      color: cfg.text,
      fontWeight: 800,
      paddingLeft: `${20*s}px`,
      paddingRight: `${20*s}px`,
    }),
    sep: (s, cfg) => ({
      color: cfg.accent,
      opacity: 0.5,
      fontWeight: 300,
    }),
    label: (s, cfg) => ({
      color: cfg.accent,
      opacity: 0.8,
      fontWeight: 600,
      letterSpacing: "0.15em",
    }),
    title: (s, cfg) => ({
      color: cfg.text,
      opacity: 0.8,
      letterSpacing: "0.2em",
      fontWeight: 700,
    }),
  },
};

// ─── TimerFace ────────────────────────────────────────────────────────────────
// Reads cfg.visualStyle (string key into VISUAL_STYLES) and merges the preset
// styles on top of the base styles. All HTML structure stays identical.
export const TimerFace = memo(function ({ time, cfg, scale = 1 }) {
  const units = [
    cfg.showDays    && { lbl: "DAYS", val: pad(time.days) },
    cfg.showHours   && { lbl: "HRS",  val: pad(time.hours) },
    cfg.showMinutes && { lbl: "MIN",  val: pad(time.minutes) },
    cfg.showSeconds && { lbl: "SEC",  val: pad(time.seconds) },
  ].filter(Boolean);
  const fs = (cfg.fontSize || 36) * scale;
  const s  = scale;

  // Resolve the visual style preset (fall back to default)
  const vs = VISUAL_STYLES[cfg.visualStyle] || VISUAL_STYLES.default;

  // Base styles for each surface
  const wrapperBase = {
    background:    cfg.transparent ? "transparent" : cfg.bg,
    padding:       `${20*s}px ${24*s}px`,
    borderRadius:  `${(cfg.borderRadius||12)*s}px`,
    fontFamily:    `'${cfg.font || "Orbitron"}', monospace`,
    border:        `${2*s}px solid ${cfg.accent}44`,
    boxShadow:     `0 ${4*s}px ${20*s}px ${cfg.accent}18`,
    display:       "inline-flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           `${10*s}px`,
  };

  const boxBase = {
    background:  cfg.box,
    color:       cfg.text,
    fontSize:    `${fs}px`,
    fontWeight:  700,
    padding:     `${10*s}px ${16*s}px`,
    borderRadius:`${7*s}px`,
    lineHeight:  1,
    minWidth:    `${52*s}px`,
    textAlign:   "center",
    border:      `1px solid ${cfg.accent}30`,
    boxShadow:   `0 ${2*s}px ${8*s}px rgba(0,0,0,.25)`,
  };

  const labelBase = {
    color:         cfg.text,
    fontSize:      `${9*s}px`,
    opacity:       0.55,
    marginTop:     `${4*s}px`,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  };

  const sepBase = {
    color:        cfg.accent,
    fontSize:     `${fs * 0.8}px`,
    fontWeight:   700,
    margin:       `0 ${3*s}px`,
    paddingBottom:`${12*s}px`,
    opacity:      0.65,
  };

  const titleBase = {
    color:         cfg.text,
    fontSize:      `${11*s}px`,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    fontWeight:    700,
    opacity:       0.9,
  };

  // Merge: base ← preset override
  const wrapperStyle = { ...wrapperBase, ...vs.wrapper(s, cfg) };
  const boxStyle     = { ...boxBase,     ...vs.box(s, cfg)     };
  const labelStyle   = { ...labelBase,   ...vs.label(s, cfg)   };
  const sepStyle     = { ...sepBase,     ...vs.sep(s, cfg)      };
  const titleStyle   = { ...titleBase,   ...vs.title(s, cfg)   };

  return (
    <div style={wrapperStyle}>
      {cfg.title && (
        <div style={titleStyle}>{cfg.title}</div>
      )}
      {time.done ? (
        <div style={{ color: cfg.accent, fontSize: `${20*s}px`, fontWeight: 700 }}>EXPIRED</div>
      ) : (
        <div style={{ display: "flex", gap: `${10*s}px`, alignItems: "flex-start" }}>
          {units.map(({ lbl, val }, i) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={boxStyle}>{val}</div>
                <div style={labelStyle}>{lbl}</div>
              </div>
              {i < units.length - 1 && (
                <div style={sepStyle}>:</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── LiveClock ────────────────────────────────────────────────────────────────
export function LiveClock({ target, mode, countUp, egHours, cfg }) {
  const [time, setTime] = useState(() => calcTime(target, mode, countUp, egHours));
  useEffect(() => {
    setTime(calcTime(target, mode, countUp, egHours));
    if (mode === "evergreen") return;
    const id = setInterval(() => setTime(calcTime(target, mode, countUp, egHours)), 1000);
    return () => clearInterval(id);
  }, [target, mode, countUp, egHours]);
  return <TimerFace time={time} cfg={cfg} scale={1} />;
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
export function Lbl({ children }) {
  return (
    <div className="text-[var(--color-muted)] text-[11px] font-semibold uppercase tracking-[0.05em] mb-1.5">
      {children}
    </div>
  );
}

export function Field({ label, mb = "mb-4", children }) {
  return (
    <div className={mb}>
      {label && <Lbl>{label}</Lbl>}
      {children}
    </div>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`bg-[var(--color-card)] border border-[var(--color-border)] rounded-[10px] p-3.5 mb-3.5 ${className}`}>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, icon, title, desc }) {
  return (
    <div onClick={onClick} className={`px-3 py-2.5 rounded-lg cursor-pointer mb-1.5 border-[1.5px] transition-all duration-150
      ${active ? "bg-[var(--color-accentBg)] border-[var(--color-accent)]" : "bg-[var(--color-card)] border-[var(--color-border)]"}`}>
      <div className={`text-xs font-bold ${active ? "text-[var(--color-accent)]" : "text-[var(--color-mid)]"}`}>
        {icon} {title}
      </div>
      <div className="text-[var(--color-muted)] text-[11px] mt-0.5">{desc}</div>
    </div>
  );
}

export function InfoBox({ colorVar, bgVar, borderVar, title, children }) {
  return (
    <div className="rounded-[10px] p-3 mb-3.5 border"
      style={{ background: cssVar(bgVar), borderColor: cssVar(borderVar), color: cssVar(colorVar) }}>
      <div className="text-xs font-bold mb-0.5">{title}</div>
      <div className="text-[11px] leading-[1.65] opacity-85">{children}</div>
    </div>
  );
}

export function inputCls() {
  return "bg-white text-[var(--color-text)] border border-[var(--color-borderDark)] rounded-[7px] px-[11px] py-2 text-[13px] w-full font-[inherit] box-border focus:outline-[var(--color-accent)] focus:outline-2 focus:outline-offset-1";
}

export function CodeBox({ code, cid, copied, copy, label }) {
  return (
    <div className="mb-4">
      {label && <Lbl>{label}</Lbl>}
      <div className="relative">
        <pre className="bg-[var(--color-codeBg)] text-[var(--color-codeText)] px-3.5 py-3 rounded-lg text-[11px] overflow-x-auto m-0 font-mono border border-[#313244] leading-[1.6] max-h-[150px] whitespace-pre-wrap break-all">
          {code}
        </pre>
        <button onClick={() => copy(code, cid)}
          className={`absolute top-2 right-2 text-white border-none rounded-[5px] px-2.5 py-1 text-[10px] cursor-pointer font-bold font-[inherit] transition-colors
            ${copied === cid ? "bg-[var(--color-green)]" : "bg-[var(--color-accent)]"}`}>
          {copied === cid ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function UnsavedNudge({ onSave }) {
  return (
    <div className="rounded-[10px] p-4 mb-4 border border-[var(--color-amberBdr)] bg-[var(--color-amberBg)] text-center">
      <div className="text-2xl mb-2">💾</div>
      <div className="text-[var(--color-amber)] font-bold text-xs mb-1">Save timer first</div>
      <div className="text-[var(--color-amber)] text-[11px] opacity-85 mb-3 leading-[1.5]">
        Save your timer to get a short permanent link for embedding and sharing.
      </div>
      <button onClick={onSave}
        className="bg-[var(--color-accent)] text-white border-none rounded-lg px-4 py-2 text-xs font-bold cursor-pointer font-[inherit]">
        Save Timer
      </button>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function Header({ user, serverOnline, onLogout, children }) {
  const statusCls = serverOnline === true
    ? "bg-[var(--color-greenBg)] border-[var(--color-greenBdr)] text-[var(--color-green)]"
    : serverOnline === false
    ? "bg-[var(--color-redBg)] border-[var(--color-redBdr)] text-[var(--color-red)]"
    : "bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-muted)]";
  const dotCls = serverOnline === true ? "bg-[#22c55e]" : serverOnline === false ? "bg-[#ef4444]" : "bg-[#94a3b8]";

  return (
    <div className="bg-[var(--color-panel)] border-b border-[var(--color-border)] px-5 py-2.5 flex items-center gap-3 flex-shrink-0 shadow-[0_1px_4px_rgba(0,0,0,.06)]">
      <div className="w-8 h-8 rounded-lg text-base bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center">⏳</div>
      <div>
        <div className="font-bold text-sm">Timerly</div>
        <div className="text-[10px] text-[var(--color-faint)]">All-in-one countdown generator</div>
      </div>
      <div className="ml-auto flex items-center gap-2 flex-wrap">
        {children}
        <div className={`flex items-center gap-1.5 px-2.5 py-[5px] rounded-full border text-[10px] font-semibold ${statusCls}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
          {serverOnline === true ? "Online" : serverOnline === false ? "Offline" : "…"}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-full">
          <div className="w-[22px] h-[22px] rounded-full bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="text-[11px] text-[var(--color-mid)] font-semibold max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap">
            {user?.email}
          </span>
        </div>
        <button onClick={onLogout}
          className="bg-[var(--color-redBg)] border border-[var(--color-redBdr)] text-[var(--color-red)] rounded-lg px-[13px] py-[7px] text-[11px] font-bold cursor-pointer font-[inherit]">
          Logout
        </button>
      </div>
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────
export function NameModal({ title, description, initialValue = "", confirmLabel = "Save", onConfirm, onClose }) {
  const [name, setName] = useState(initialValue);
  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-7 w-[360px] shadow-[0_8px_40px_rgba(0,0,0,.2)]">
        <div className="font-bold text-base mb-1 text-[var(--color-text)]">{title}</div>
        <div className="text-[var(--color-muted)] text-xs mb-[18px] leading-[1.5]">{description}</div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onConfirm(name.trim())}
          placeholder="e.g. Black Friday Sale"
          className={`${inputCls()} mb-5 text-sm`} />
        <div className="flex gap-2.5 justify-end">
          <button onClick={onClose}
            className="px-5 py-2 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-mid)] font-semibold text-[13px] cursor-pointer font-[inherit]">
            Cancel
          </button>
          <button onClick={() => name.trim() && onConfirm(name.trim())} disabled={!name.trim()}
            className={`px-5 py-2 rounded-lg border-none bg-[var(--color-accent)] text-white font-bold text-[13px] cursor-pointer font-[inherit] transition-opacity ${name.trim() ? "opacity-100" : "opacity-45"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteModal({ timerName, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-7 w-[340px] shadow-[0_8px_40px_rgba(0,0,0,.2)]">
        <div className="text-[32px] text-center mb-2.5">🗑️</div>
        <div className="font-bold text-[15px] text-center text-[var(--color-text)] mb-1.5">Delete Timer?</div>
        <div className="text-[var(--color-muted)] text-xs text-center mb-5 leading-[1.6]">
          <strong className="text-[var(--color-text)]">"{timerName}"</strong> will be permanently deleted.
        </div>
        <div className="flex gap-2.5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-mid)] font-semibold text-[13px] cursor-pointer font-[inherit]">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg border-none bg-[var(--color-red)] text-white font-bold text-[13px] cursor-pointer font-[inherit]">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}