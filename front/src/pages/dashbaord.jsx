import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  COLORS,
  TYPOGRAPHY,
  TIMER_TEMPLATES,
  TIMEZONES,
  DEFAULT_TIMER_CFG,
  cssVar,
} from "../theme";

const API = import.meta.env.VITE_BACKEND_URL;

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
});

async function apiFetch(url, options = {}) {
  let res = await fetch(url, { ...options, headers: authHeaders() });
  if (res.status === 401) {
    const refresh = await fetch(`${API}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refresh.ok) {
      const { accessToken } = await refresh.json();
      localStorage.setItem("accessToken", accessToken);
      res = await fetch(url, { ...options, headers: authHeaders() });
    } else {
      localStorage.removeItem("accessToken");
      window.location.href = "/login";
    }
  }
  return res;
}

// ─── Timer helpers ────────────────────────────────────────────────────────────
function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function calcTime(target, mode, countUp, egHours) {
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

// Used only for the live editor preview (before/without saving)
function buildParams(cfg, target, mode, egHours, timezone) {
  return new URLSearchParams({
    target, mode, egHours, timezone,
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

// Short URLs — server reconstructs params from DB by timer ID
function timerGifUrl(id)   { return `${API}/t/${id}/gif`; }
function timerEmbedUrl(id) { return `${API}/t/${id}/embed`; }
function timerShareUrl(id) { return `${window.location.origin}/t/${id}`; }

function defaultTarget() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// ─── TimerFace ────────────────────────────────────────────────────────────────
const TimerFace = memo(function ({ time, cfg, scale = 1 }) {
  const units = [
    cfg.showDays    && { lbl: "DAYS", val: pad(time.days) },
    cfg.showHours   && { lbl: "HRS",  val: pad(time.hours) },
    cfg.showMinutes && { lbl: "MIN",  val: pad(time.minutes) },
    cfg.showSeconds && { lbl: "SEC",  val: pad(time.seconds) },
  ].filter(Boolean);
  const fs = (cfg.fontSize || 36) * scale;

  return (
    <div style={{
      background: cfg.transparent ? "transparent" : cfg.bg,
      padding: `${20 * scale}px ${24 * scale}px`,
      borderRadius: `${(cfg.borderRadius || 12) * scale}px`,
      fontFamily: `'${cfg.font || "Orbitron"}', monospace`,
      border: `${2 * scale}px solid ${cfg.accent}44`,
      boxShadow: `0 ${4 * scale}px ${20 * scale}px ${cfg.accent}18`,
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      gap: `${10 * scale}px`,
    }}>
      {cfg.title && (
        <div style={{ color: cfg.text, fontSize: `${11 * scale}px`, letterSpacing: "0.18em",
          textTransform: "uppercase", fontWeight: 700, opacity: 0.9 }}>
          {cfg.title}
        </div>
      )}
      {time.done ? (
        <div style={{ color: cfg.accent, fontSize: `${20 * scale}px`, fontWeight: 700 }}>EXPIRED</div>
      ) : (
        <div style={{ display: "flex", gap: `${10 * scale}px`, alignItems: "flex-start" }}>
          {units.map(({ lbl, val }, i) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  background: cfg.box, color: cfg.text, fontSize: `${fs}px`, fontWeight: 700,
                  padding: `${10 * scale}px ${16 * scale}px`, borderRadius: `${7 * scale}px`,
                  lineHeight: 1, minWidth: `${52 * scale}px`, textAlign: "center",
                  border: `1px solid ${cfg.accent}30`,
                  boxShadow: `0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,.25)`,
                }}>{val}</div>
                <div style={{ color: cfg.text, fontSize: `${9 * scale}px`, opacity: 0.55,
                  marginTop: `${4 * scale}px`, letterSpacing: "0.14em" }}>{lbl}</div>
              </div>
              {i < units.length - 1 && (
                <div style={{ color: cfg.accent, fontSize: `${fs * 0.8}px`, fontWeight: 700,
                  margin: `0 ${3 * scale}px`, paddingBottom: `${12 * scale}px`, opacity: 0.65 }}>:</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

function LiveClock({ target, mode, countUp, egHours, cfg }) {
  const [time, setTime] = useState(() => calcTime(target, mode, countUp, egHours));
  useEffect(() => {
    setTime(calcTime(target, mode, countUp, egHours));
    if (mode === "evergreen") return;
    const id = setInterval(() => setTime(calcTime(target, mode, countUp, egHours)), 1000);
    return () => clearInterval(id);
  }, [target, mode, countUp, egHours]);
  return <TimerFace time={time} cfg={cfg} scale={1} />;
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function Lbl({ children }) {
  return (
    <div className="text-[var(--color-muted)] text-[11px] font-semibold uppercase tracking-[0.05em] mb-1.5">
      {children}
    </div>
  );
}

function Field({ label, mb = "mb-4", children }) {
  return (
    <div className={mb}>
      {label && <Lbl>{label}</Lbl>}
      {children}
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-[var(--color-card)] border border-[var(--color-border)] rounded-[10px] p-3.5 mb-3.5 ${className}`}>
      {children}
    </div>
  );
}

function Chip({ active, onClick, icon, title, desc }) {
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

function InfoBox({ colorVar, bgVar, borderVar, title, children }) {
  return (
    <div className="rounded-[10px] p-3 mb-3.5 border"
      style={{ background: cssVar(bgVar), borderColor: cssVar(borderVar), color: cssVar(colorVar) }}>
      <div className="text-xs font-bold mb-0.5">{title}</div>
      <div className="text-[11px] leading-[1.65] opacity-85">{children}</div>
    </div>
  );
}

function inputCls() {
  return "bg-white text-[var(--color-text)] border border-[var(--color-borderDark)] rounded-[7px] px-[11px] py-2 text-[13px] w-full font-[inherit] box-border focus:outline-[var(--color-accent)] focus:outline-2 focus:outline-offset-1";
}

function CodeBox({ code, cid, copied, copy, label }) {
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

// Shown on email/embed/share tabs when timer hasn't been saved yet
function UnsavedNudge({ onSave }) {
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

// ─── Modals ───────────────────────────────────────────────────────────────────
function NameModal({ title, description, initialValue = "", confirmLabel = "Save", onConfirm, onClose }) {
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

function DeleteModal({ timerName, onConfirm, onClose }) {
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

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ user, serverOnline, onLogout, children }) {
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

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ user, serverOnline, timers, loading, onNew, onEdit, onDelete, onLogout }) {
  const [deleteModal, setDeleteModal] = useState(null);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col font-[var(--font-sans)]">
      <Header user={user} serverOnline={serverOnline} onLogout={onLogout}>
        <button onClick={onNew}
          className="bg-[var(--color-accent)] text-white border-none rounded-lg px-[18px] py-2 text-[13px] font-bold cursor-pointer font-[inherit]">
          + New Timer
        </button>
      </Header>

      <div className="flex-1 px-7 py-8 max-w-[1100px] w-full mx-auto box-border">
        <div className="mb-7">
          <div className="text-[22px] font-bold text-[var(--color-text)] mb-1">My Timers</div>
          <div className="text-[13px] text-[var(--color-muted)]">
            {timers.length === 0
              ? "Create your first countdown timer to get started."
              : `You have ${timers.length} saved timer${timers.length !== 1 ? "s" : ""}.`}
          </div>
        </div>

        {loading && (
          <div className="text-center py-[60px] text-[var(--color-faint)] text-sm">Loading timers…</div>
        )}

        {!loading && timers.length === 0 && (
          <div className="text-center py-[72px] px-5">
            <div className="text-[52px] mb-4">⏳</div>
            <div className="text-lg font-bold text-[var(--color-mid)] mb-2">No timers yet</div>
            <div className="text-[13px] text-[var(--color-muted)] mb-6">Create a countdown for your next sale, launch, or event.</div>
            <button onClick={onNew}
              className="bg-[var(--color-accent)] text-white border-none rounded-[10px] px-7 py-3 text-sm font-bold cursor-pointer font-[inherit]">
              + Create First Timer
            </button>
          </div>
        )}

        {!loading && timers.length > 0 && (
          <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            <div onClick={onNew}
              className="border-2 border-dashed border-[var(--color-accentBdr)] rounded-2xl p-7 flex flex-col items-center justify-center gap-2.5 cursor-pointer bg-[var(--color-accentBg)] transition-all duration-150 min-h-[160px] hover:border-[var(--color-accent)]">
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-2xl font-light">+</div>
              <div className="text-[var(--color-accent)] font-bold text-[13px]">New Timer</div>
            </div>
            {timers.map((timer) => (
              <TimerGridCard key={timer.id} timer={timer}
                onEdit={() => onEdit(timer)}
                onDelete={() => setDeleteModal(timer)} />
            ))}
          </div>
        )}
      </div>

      {deleteModal && (
        <DeleteModal
          timerName={deleteModal.name}
          onConfirm={() => { onDelete(deleteModal); setDeleteModal(null); }}
          onClose={() => setDeleteModal(null)} />
      )}
    </div>
  );
}

// ─── Timer Grid Card ──────────────────────────────────────────────────────────
function TimerGridCard({ timer, onEdit, onDelete }) {
  const modeLabel = { countdown: "Countdown", countup: "Count Up", evergreen: "Evergreen" }[timer.mode] || "Countdown";
  const modeIcon  = { countdown: "⏱", countup: "⬆", evergreen: "♻" }[timer.mode] || "⏱";
  const bg        = timer.cfg?.bg || "#0f0f1a";

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-[var(--shadow-md)] flex flex-col transition-shadow duration-150 hover:shadow-[var(--shadow-lg)]">
      <div className="p-4 flex items-center justify-between" style={{ background: bg }}>
        <div className="flex gap-1.5">
          {[timer.cfg?.bg, timer.cfg?.box, timer.cfg?.text, timer.cfg?.accent].map((c, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full border border-white/25" style={{ background: c || "#888" }} />
          ))}
        </div>
        <div className="bg-white/15 rounded-full px-2.5 py-[3px] text-[10px] font-bold text-white flex items-center gap-1">
          {modeIcon} {modeLabel}
        </div>
      </div>
      <div className="px-4 py-3.5 flex-1">
        <div className="font-bold text-sm text-[var(--color-text)] mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
          {timer.name}
        </div>
        <div className="text-[11px] text-[var(--color-muted)]">
          {timer.cfg?.title && <span className="mr-2 text-[var(--color-faint)]">"{timer.cfg.title}"</span>}
          {timer.mode === "evergreen"
            ? `Resets every ${timer.egHours}h`
            : new Date(timer.target).toLocaleDateString(undefined, {
                month: "short", day: "numeric", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
        </div>
      </div>
      <div className="px-3.5 py-2.5 border-t border-[var(--color-border)] flex gap-2">
        <button onClick={onEdit}
          className="flex-1 py-2 rounded-lg border border-[var(--color-accentBdr)] bg-[var(--color-accentBg)] text-[var(--color-accent)] font-bold text-xs cursor-pointer font-[inherit]">
          ✏️ Edit
        </button>
        <button onClick={onDelete}
          className="px-3 py-2 rounded-lg border border-[var(--color-redBdr)] bg-[var(--color-redBg)] text-[var(--color-red)] font-bold text-xs cursor-pointer font-[inherit]">
          🗑️
        </button>
      </div>
    </div>
  );
}

// ─── Editor Screen ────────────────────────────────────────────────────────────
function EditorScreen({ user, serverOnline, initialTimer, onSaved, onBack, onLogout }) {
  const isNew = !initialTimer;

  const [tab,      setTab]      = useState("timer");
  const [target,   setTarget]   = useState(initialTimer?.target || defaultTarget());
  const [timezone, setTimezone] = useState(initialTimer?.timezone || "UTC");
  const [mode,     setMode]     = useState(initialTimer?.mode || "countdown");
  const [egHours,  setEgHours]  = useState(initialTimer?.egHours || 48);
  const [cfg,      setCfg]      = useState(initialTimer ? { ...DEFAULT_TIMER_CFG, ...initialTimer.cfg } : DEFAULT_TIMER_CFG);

  // null = new unsaved timer; number = saved DB id
  const [savedId,    setSavedId]    = useState(initialTimer?.id ?? null);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveModal,  setSaveModal]  = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const [copied,     setCopied]     = useState("");

  const sc      = useCallback((k, v) => setCfg((c) => ({ ...c, [k]: v })), []);
  const countUp = mode === "countup";

  // Preview pane always uses live param URL (no save needed)
  const previewParams   = buildParams(cfg, target, mode, egHours, timezone);
  const previewEmbedUrl = `${API}/api/timer/embed?${previewParams}`;

  // Shareable URLs — only available once saved
  const shortGifUrl   = savedId ? timerGifUrl(savedId)   : null;
  const shortEmbedUrl = savedId ? timerEmbedUrl(savedId) : null;
  const shareLink     = savedId ? timerShareUrl(savedId) : null;
  const qrUrl         = shareLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareLink)}&bgcolor=ffffff&color=${COLORS.accent.replace("#", "")}&qzone=2`
    : null;

  // ── Email / embed code snippets ──────────────────────────────────────────
  // GIF rendered at 600px — the standard email column width.
  // height:auto lets the image scale proportionally on any screen.
  // width="600" as an HTML attribute is respected by Outlook (ignores CSS).
  const imgTag = shortGifUrl
    ? `<img src="${shortGifUrl}"\n  width="600"\n  style="display:block;width:100%;max-width:600px;height:auto;border:0;"\n  alt="${cfg.title || "Countdown Timer"}">`
    : "";

  const emailBlock = shortGifUrl
    ? `<!-- ${cfg.title || "Countdown Timer"} -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;">
  <tr>
    <td align="center" bgcolor="${cfg.bg}" style="padding:32px 24px;border-radius:${cfg.borderRadius}px;">
      <img src="${shortGifUrl}"
        width="600"
        style="display:block;width:100%;max-width:600px;height:auto;border:0;"
        alt="${cfg.title || "Countdown Timer"}">
    </td>
  </tr>
</table>`
    : "";

  // Responsive iframe wrapper using the padding-bottom aspect-ratio trick
  const iframeTag = shortEmbedUrl
    ? `<!-- Responsive countdown embed -->\n<div style="position:relative;width:100%;max-width:600px;padding-bottom:28%;height:0;overflow:hidden;">\n  <iframe src="${shortEmbedUrl}"\n    style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;overflow:hidden;"\n    scrolling="no" title="${cfg.title || "Countdown Timer"}">\n  </iframe>\n</div>`
    : "";

  const copy = useCallback((text, id) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(""), 2200);
  }, []);

  const currentPayload = (name) => ({ name, target, mode, egHours, timezone, cfg });

  // Core save — used by header Save button
  const handleSaveNew = async (name) => {
    setSaveModal(false);
    setSaveStatus("saving");
    try {
      const res = await apiFetch(`${API}/api/timers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPayload(name)),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setSavedId(saved.id);
      setSaveStatus("saved");
      setTimeout(() => { setSaveStatus(""); onSaved(saved); }, 1200);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 1200);
    }
  };

  // Save triggered by clicking a locked tab — jumps to that tab after saving
  const handleSaveNewFromTab = async (name) => {
    setSaveModal(false);
    setSaveStatus("saving");
    try {
      const res = await apiFetch(`${API}/api/timers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPayload(name)),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setSavedId(saved.id);
      setSaveStatus("saved");
      if (pendingTab) setTab(pendingTab);
      setPendingTab(null);
      setTimeout(() => { setSaveStatus(""); onSaved(saved); }, 1200);
    } catch {
      setSaveStatus("error");
      setPendingTab(null);
      setTimeout(() => setSaveStatus(""), 1200);
    }
  };

  const handleUpdate = async () => {
    if (!initialTimer) return;
    setSaveStatus("saving");
    try {
      const res = await apiFetch(`${API}/api/timers/${initialTimer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPayload(initialTimer.name)),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setSaveStatus("saved");
      setTimeout(() => { setSaveStatus(""); onSaved(saved); }, 1200);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 1200);
    }
  };

  // Tab click: email/embed/share require a saved ID
  const handleTabClick = (id) => {
    if (["email", "embed", "share"].includes(id) && !savedId) {
      setPendingTab(id);
      setSaveModal(true);
    } else {
      setTab(id);
    }
  };

  const isSaved      = !!savedId;
  const saveBtnLabel = saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved!" : saveStatus === "error" ? "✗ Error" : (!isSaved ? "Save Timer" : "Save Changes");
  const saveBtnBg    = saveStatus === "saved" ? "var(--color-green)" : saveStatus === "error" ? "var(--color-red)" : "var(--color-accent)";

  const TABS = [
    { id: "timer",  label: "⏱ Timer"  },
    { id: "design", label: "🎨 Design" },
    { id: "email",  label: "📧 Email"  },
    { id: "embed",  label: "🌐 Embed"  },
    { id: "share",  label: "🔗 Share"  },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-[var(--font-sans)] flex flex-col">
      <style>{`
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        input[type=range]{accent-color:var(--color-accent);width:100%;cursor:pointer;}
        input[type=color]{cursor:pointer;}
        select,input,button,textarea{font-family:inherit;}
        input:focus,select:focus{outline:2px solid var(--color-accent);outline-offset:1px;border-radius:7px;}
        @media(max-width:800px){
          .editor-body{flex-direction:column!important;}
          .editor-preview{border-right:none!important;border-bottom:1px solid var(--color-border)!important;min-height:220px!important;}
          .editor-sidebar{width:100%!important;}
        }
      `}</style>

      <Header user={user} serverOnline={serverOnline} onLogout={onLogout}>
        <button onClick={onBack}
          className="bg-white text-[var(--color-mid)] border border-[var(--color-border)] rounded-lg px-3.5 py-[7px] text-xs font-semibold cursor-pointer font-[inherit] flex items-center gap-1.5">
          ← My Timers
        </button>
        <div className={`px-3 py-[5px] rounded-full text-[11px] font-bold border ${
          !isSaved
            ? "bg-[var(--color-purpleBg)] border-[var(--color-purpleBdr)] text-[var(--color-purple)]"
            : "bg-[var(--color-amberBg)] border-[var(--color-amberBdr)] text-[var(--color-amber)]"
        }`}>
          {!isSaved ? "✨ New Timer" : `✏️ Editing: ${initialTimer?.name ?? "Timer"}`}
        </div>
        <button
          onClick={!isSaved ? () => setSaveModal(true) : handleUpdate}
          disabled={saveStatus === "saving"}
          className="text-white border-none rounded-lg px-[18px] py-2 text-[13px] font-bold cursor-pointer font-[inherit] min-w-[120px] transition-colors duration-200"
          style={{ background: saveBtnBg }}>
          {saveBtnLabel}
        </button>
      </Header>

      <div className="editor-body flex-1 flex overflow-hidden min-h-0">

        {/* Preview pane */}
        <div className="editor-preview flex-1 flex flex-col items-center justify-center gap-5 p-8 overflow-y-auto relative border-r border-[var(--color-border)]"
          style={{ background: "linear-gradient(135deg,#eef2ff 0%,#f1f5f9 50%,#eff6ff 100%)" }}>
          <div className="absolute inset-0 opacity-25 pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle,#c7d2fe 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
          <div className="relative z-10 text-center">
            <div className="text-[var(--color-faint)] text-[10px] tracking-[0.25em] uppercase font-semibold mb-[18px]">LIVE PREVIEW</div>
            <div className="bg-white rounded-2xl p-6 inline-block shadow-[var(--shadow-xl)]">
              <LiveClock target={target} mode={mode} countUp={countUp} egHours={egHours} cfg={cfg} />
            </div>
            {mode === "evergreen" && (
              <div className="text-[var(--color-accent)] text-[11px] mt-3 font-medium">
                ⚡ Evergreen — resets each time email opens
              </div>
            )}
          </div>
          <div className="flex gap-2.5 flex-wrap justify-center relative z-10">
            {[
              { l: "Mode",     v: mode === "evergreen" ? "Evergreen ♻" : mode === "countup" ? "Count Up ↑" : "Countdown ↓" },
              { l: "Timezone", v: timezone.split("/").pop() },
              { l: "ID",       v: savedId ? `#${savedId}` : "unsaved" },
            ].map((s) => (
              <div key={s.l} className="bg-white border border-[var(--color-border)] rounded-[9px] px-3.5 py-[7px] text-center shadow-[var(--shadow-sm)]">
                <div className="text-[var(--color-faint)] text-[9px] uppercase tracking-[0.1em] font-semibold">{s.l}</div>
                <div className="text-[var(--color-mid)] text-xs font-mono mt-0.5 font-semibold">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="editor-sidebar w-[410px] flex flex-col bg-[var(--color-panel)] border-l border-[var(--color-border)] overflow-hidden flex-shrink-0">
          <div className="flex border-b border-[var(--color-border)] bg-[var(--color-card)] flex-shrink-0">
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => handleTabClick(id)}
                className={`flex-1 py-[11px] px-0.5 border-none cursor-pointer text-[10px] font-[inherit] transition-all duration-150 capitalize tracking-[0.03em] border-b-2
                  ${tab === id
                    ? "bg-[var(--color-panel)] text-[var(--color-accent)] font-bold border-[var(--color-accent)]"
                    : "bg-transparent text-[var(--color-muted)] font-medium border-transparent"
                  }`}>
                {label}
                {["email","embed","share"].includes(id) && !savedId && (
                  <span className="ml-0.5 opacity-40">🔒</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-[18px]">

            {/* ── Timer tab ── */}
            {tab === "timer" && (
              <div>
                <Field label="Event Title">
                  <input value={cfg.title} onChange={(e) => sc("title", e.target.value)}
                    className={inputCls()} placeholder="OFFER ENDS IN" />
                </Field>
                <Field label="Target Date & Time">
                  <input type="datetime-local" value={target} onChange={(e) => setTarget(e.target.value)}
                    className={`${inputCls()} ${mode === "evergreen" ? "opacity-40" : ""}`}
                    disabled={mode === "evergreen"} />
                </Field>
                <Field label="Timezone">
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls()}>
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </Field>
                <Card>
                  <Lbl>Timer Mode</Lbl>
                  <Chip active={mode === "countdown"} onClick={() => setMode("countdown")} icon="⏱" title="Countdown"  desc="Count down to a specific date" />
                  <Chip active={mode === "countup"}   onClick={() => setMode("countup")}   icon="⬆" title="Count Up"   desc="Count up from a date" />
                  <Chip active={mode === "evergreen"} onClick={() => setMode("evergreen")} icon="♻" title="Evergreen"  desc="Starts fresh each time email opens" />
                </Card>
                {mode === "evergreen" && (
                  <Card>
                    <Lbl>Duration: {egHours}h ({Math.floor(egHours / 24)}d {egHours % 24}h)</Lbl>
                    <input type="range" min={1} max={168} value={egHours} onChange={(e) => setEgHours(+e.target.value)} />
                    <div className="flex justify-between text-[var(--color-faint)] text-[10px] mt-1">
                      <span>1h</span><span>1 week</span>
                    </div>
                  </Card>
                )}
                <Card>
                  <Lbl>Show Units</Lbl>
                  <div className="grid grid-cols-2 gap-2">
                    {[["showDays","Days"],["showHours","Hours"],["showMinutes","Minutes"],["showSeconds","Seconds"]].map(([k, l]) => (
                      <label key={k} className="flex items-center gap-2 cursor-pointer px-[11px] py-[9px] bg-white border border-[var(--color-border)] rounded-[7px]">
                        <input type="checkbox" checked={cfg[k]} onChange={(e) => sc(k, e.target.checked)}
                          className="w-[15px] h-[15px] cursor-pointer accent-[var(--color-accent)]" />
                        <span className="text-[var(--color-mid)] text-xs font-medium">{l}</span>
                      </label>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── Design tab ── */}
            {tab === "design" && (
              <div>
                <Lbl>Templates</Lbl>
                <div className="grid grid-cols-3 gap-2 mb-[18px]">
                  {TIMER_TEMPLATES.map((t) => (
                    <div key={t.name}
                      onClick={() => setCfg((c) => ({ ...c, bg: t.bg, box: t.box, text: t.text, accent: t.accent }))}
                      className="p-2.5 rounded-[9px] cursor-pointer text-center shadow-[0_1px_4px_rgba(0,0,0,.12)]"
                      style={{ background: t.bg, border: `2px solid ${t.accent}55` }}>
                      <div className="text-[10px] font-bold mb-[5px]" style={{ color: t.text }}>{t.name}</div>
                      <div className="flex gap-[3px] justify-center">
                        {[t.bg, t.box, t.text, t.accent].map((c, i) => (
                          <div key={i} className="w-[9px] h-[9px] rounded-full border border-black/20" style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Card>
                  <Lbl>Colors</Lbl>
                  {[["bg","Background"],["box","Number Box"],["text","Text"],["accent","Accent"]].map(([k, l]) => (
                    <div key={k} className="flex items-center gap-2.5 mb-3">
                      <input type="color" value={cfg[k]} onChange={(e) => sc(k, e.target.value)}
                        className="w-9 h-9 border border-[var(--color-border)] rounded-[7px] p-0.5 flex-shrink-0" />
                      <span className="text-[var(--color-mid)] text-xs font-medium flex-1">{l}</span>
                      <code className="text-[var(--color-muted)] text-[10px] bg-[var(--color-card)] px-[7px] py-[2px] rounded border border-[var(--color-border)] font-mono">{cfg[k]}</code>
                    </div>
                  ))}
                </Card>
                <Field label="Font">
                  <select value={cfg.font} onChange={(e) => sc("font", e.target.value)}
                    className={inputCls()} style={{ fontFamily: `'${cfg.font}', monospace` }}>
                    {TYPOGRAPHY.timerFonts.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`Font Size: ${cfg.fontSize}px`} mb="mb-3.5">
                  <input type="range" min={18} max={48} value={cfg.fontSize} onChange={(e) => sc("fontSize", +e.target.value)} />
                </Field>
                <Field label={`Corner Radius: ${cfg.borderRadius}px`} mb="mb-3.5">
                  <input type="range" min={0} max={32} value={cfg.borderRadius} onChange={(e) => sc("borderRadius", +e.target.value)} />
                </Field>
                <label className="flex items-center gap-[9px] cursor-pointer px-[13px] py-2.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg mb-3.5">
                  <input type="checkbox" checked={cfg.transparent} onChange={(e) => sc("transparent", e.target.checked)}
                    className="w-[15px] h-[15px] cursor-pointer accent-[var(--color-accent)]" />
                  <span className="text-[var(--color-mid)] text-xs font-medium">Transparent Background</span>
                </label>
              </div>
            )}

            {/* ── Email tab ── */}
            {tab === "email" && (
              <div>
                {!savedId
                  ? <UnsavedNudge onSave={() => setSaveModal(true)} />
                  : <>
                    <InfoBox colorVar="accent" bgVar="accentBg" borderVar="accentBdr" title="📧 Email Countdown GIF">
                      Rendered at 600px — the standard email width. Scales perfectly on mobile with <code>width:100%</code>.
                    </InfoBox>
                    {serverOnline && (
                      <Card>
                        <Lbl>Live GIF Preview</Lbl>
                        <div className="bg-[#111] rounded-lg p-3 text-center mb-2">
                          <img key={savedId} src={shortGifUrl} alt="Timer GIF"
                            style={{ display: "block", width: "100%", height: "auto", borderRadius: 6 }} />
                        </div>
                      </Card>
                    )}
                    <CodeBox code={imgTag}     cid="img"   copied={copied} copy={copy} label="📋 Quick img tag" />
                    <CodeBox code={emailBlock} cid="email" copied={copied} copy={copy} label="Full HTML Email Block" />
                    <InfoBox colorVar="amber" bgVar="amberBg" borderVar="amberBdr" title="🍎 Apple Mail / MPP Note">
                      Apple Mail pre-fetches images which can freeze the GIF at frame 1. Use Litmus or Email on Acid to test.
                    </InfoBox>
                  </>
                }
              </div>
            )}

            {/* ── Embed tab ── */}
            {tab === "embed" && (
              <div>
                {!savedId
                  ? <UnsavedNudge onSave={() => setSaveModal(true)} />
                  : <>
                    <InfoBox colorVar="blue" bgVar="blueBg" borderVar="blueBdr" title="🌐 Website iFrame Embed">
                      Fully responsive — the wrapper div scales the iframe to any screen width automatically.
                    </InfoBox>
                    {serverOnline && (
                      <Card>
                        <Lbl>Live Embed Preview</Lbl>
                        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden h-[130px]" style={{ background: cfg.bg }}>
                          <iframe key={savedId} src={shortEmbedUrl} className="w-full h-full border-none block" title="Timer Embed" />
                        </div>
                      </Card>
                    )}
                    <CodeBox code={iframeTag} cid="iframe" copied={copied} copy={copy} label="📋 Responsive iframe (paste into website)" />
                    <Card>
                      <Lbl>Direct embed URL</Lbl>
                      <div className="flex gap-2 items-center">
                        <input readOnly value={shortEmbedUrl}
                          className={`${inputCls()} text-[10px] text-[var(--color-muted)] bg-[var(--color-card)] flex-1`} />
                        <button onClick={() => copy(shortEmbedUrl, "eu")}
                          className={`text-white border-none rounded-[6px] px-3 py-2 text-[11px] cursor-pointer font-bold whitespace-nowrap flex-shrink-0 font-[inherit]
                            ${copied === "eu" ? "bg-[var(--color-green)]" : "bg-[var(--color-accent)]"}`}>
                          {copied === "eu" ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                    </Card>
                  </>
                }
              </div>
            )}

            {/* ── Share tab ── */}
            {tab === "share" && (
              <div>
                {!savedId
                  ? <UnsavedNudge onSave={() => setSaveModal(true)} />
                  : <>
                    <Lbl>Share Link</Lbl>
                    <div className="flex gap-2 mb-4 items-stretch">
                      <input value={shareLink} readOnly
                        className={`${inputCls()} flex-1 text-[10px] text-[var(--color-muted)] bg-[var(--color-card)]`} />
                      <button onClick={() => copy(shareLink, "sl")}
                        className={`text-white border-none rounded-[7px] px-3.5 py-2 text-[11px] cursor-pointer font-bold whitespace-nowrap flex-shrink-0 font-[inherit]
                          ${copied === "sl" ? "bg-[var(--color-green)]" : "bg-[var(--color-accent)]"}`}>
                        {copied === "sl" ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <Lbl>QR Code</Lbl>
                    <div className="bg-white border border-[var(--color-border)] rounded-[10px] p-5 text-center mb-4">
                      <img src={qrUrl} alt="QR" width={150} height={150} className="rounded-lg block mx-auto" />
                      <div className="text-[var(--color-muted)] text-[11px] mt-2.5 font-medium">Scan to open countdown</div>
                    </div>
                    <Lbl>Share to Social</Lbl>
                    {[
                      { name: "Twitter / X", color: "#1da1f2", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent("⏱ " + cfg.title + " " + shareLink)}` },
                      { name: "Facebook",    color: "#1877f2", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}` },
                      { name: "WhatsApp",    color: "#25d366", url: `https://wa.me/?text=${encodeURIComponent("⏱ " + cfg.title + " " + shareLink)}` },
                      { name: "LinkedIn",    color: "#0a66c2", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}` },
                    ].map((s) => (
                      <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border-[1.5px] border-[var(--color-border)] rounded-lg mb-2 no-underline text-xs font-semibold transition-colors"
                        style={{ color: s.color }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        Share on {s.name} ↗
                      </a>
                    ))}
                  </>
                }
              </div>
            )}

          </div>
        </div>
      </div>

      {saveModal && (
        <NameModal
          title="Save Timer"
          description="Give this timer a name so you can find it later."
          confirmLabel="Save Timer"
          onConfirm={pendingTab ? handleSaveNewFromTab : handleSaveNew}
          onClose={() => { setSaveModal(false); setPendingTab(null); }} />
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [user,         setUser]         = useState(null);
  const [timers,       setTimers]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [serverOnline, setServerOnline] = useState(null);
  const [screen,       setScreen]       = useState("home");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { navigate("/login"); return; }
    try { setUser(jwtDecode(token)); }
    catch { localStorage.removeItem("accessToken"); navigate("/login"); }
  }, [navigate]);

  const handleLogout = () => { localStorage.removeItem("accessToken"); navigate("/login"); };

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.ok ? setServerOnline(true) : setServerOnline(false))
      .catch(() => setServerOnline(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    apiFetch(`${API}/api/timers`)
      .then((r) => r.json())
      .then((d) => setTimers(Array.isArray(d) ? d : []))
      .catch(() => setTimers([]))
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (timer) => {
    try {
      await apiFetch(`${API}/api/timers/${timer.id}`, { method: "DELETE" });
      setTimers((prev) => prev.filter((t) => t.id !== timer.id));
    } catch { /* silent */ }
  };

  const handleSaved = (savedTimer) => {
    setTimers((prev) => {
      const exists = prev.find((t) => t.id === savedTimer.id);
      return exists
        ? prev.map((t) => t.id === savedTimer.id ? savedTimer : t)
        : [savedTimer, ...prev];
    });
    setScreen("home");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen font-[var(--font-sans)] text-[var(--color-muted)]">
        Loading…
      </div>
    );
  }

  if (screen === "home") {
    return (
      <HomeScreen
        user={user} serverOnline={serverOnline} timers={timers} loading={loading}
        onNew={() => setScreen("new")} onEdit={(timer) => setScreen(timer)}
        onDelete={handleDelete} onLogout={handleLogout} />
    );
  }

  return (
    <EditorScreen
      user={user} serverOnline={serverOnline}
      initialTimer={screen === "new" ? null : screen}
      onSaved={handleSaved} onBack={() => setScreen("home")} onLogout={handleLogout} />
  );
}