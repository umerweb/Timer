import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { API, apiFetch } from "../utils/api";
import { Header, DeleteModal } from "../components/timerUtils";

// ─── Timer Grid Card ──────────────────────────────────────────────────────────
function TimerGridCard({ timer, onEdit, onDelete }) {
  const modeLabel = { countdown: "Countdown", countup: "Count Up", evergreen: "Evergreen" }[timer.mode] || "Countdown";
  const modeIcon  = { countdown: "⏱", countup: "⬆", evergreen: "♻" }[timer.mode] || "⏱";
  const bg        = timer.cfg?.bg || "#0f0f1a";

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-[var(--shadow-md)] flex flex-col transition-shadow duration-150 hover:shadow-[var(--shadow-lg)]">
      {/* Color swatch header */}
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

      {/* Info */}
      <div className="px-4 py-3.5 flex-1">
        <div className="font-bold text-sm text-[var(--color-text)] mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
          {timer.name}
        </div>
        <div className="text-[11px] text-[var(--color-muted)]">
          {timer.cfg?.title && (
            <span className="mr-2 text-[var(--color-faint)]">"{timer.cfg.title}"</span>
          )}
          {timer.mode === "evergreen"
            ? `Resets every ${timer.egHours}h`
            : new Date(timer.target).toLocaleDateString(undefined, {
                month: "short", day: "numeric", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
        </div>
         <div className="text-[11px] text-[var(--color-faint)] mt-1.5 flex items-center gap-1">
    👁 {timer.views ?? 0} view{(timer.views ?? 0) !== 1 ? "s" : ""}
  </div>
      </div>

      {/* Actions */}
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

// ─── Dashboard (Home only) ────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();

  const [user,         setUser]         = useState(null);
  const [timers,       setTimers]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [serverOnline, setServerOnline] = useState(null);
  const [deleteModal,  setDeleteModal]  = useState(null);

  // ── Auth check ───────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { navigate("/login"); return; }
    try {
      setUser(jwtDecode(token));
    } catch {
      localStorage.removeItem("accessToken");
      navigate("/login");
    }
  }, [navigate]);

  // ── Server health check ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => setServerOnline(r.ok))
      .catch(() => setServerOnline(false));
  }, []);

  // ── Load timers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    apiFetch(`${API}/api/timers`)
      .then((r) => r.json())
      .then((d) => setTimers(Array.isArray(d) ? d : []))
      .catch(() => setTimers([]))
      .finally(() => setLoading(false));
  }, [user]);

  // ── Delete handler ───────────────────────────────────────────────────────
  const handleDelete = async (timer) => {
    try {
      await apiFetch(`${API}/api/timers/${timer.id}`, { method: "DELETE" });
      setTimers((prev) => prev.filter((t) => t.id !== timer.id));
    } catch { /* silent */ }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  // ── Loading / auth guard ─────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen font-[var(--font-sans)] text-[var(--color-muted)]">
        Loading…
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col font-[var(--font-sans)]">
      <Header user={user} serverOnline={serverOnline} onLogout={handleLogout}>
        <button
          onClick={() => navigate("/timer/new")}
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

        {/* Loading */}
        {loading && (
          <div className="text-center py-[60px] text-[var(--color-faint)] text-sm">
            Loading timers…
          </div>
        )}

        {/* Empty state */}
        {!loading && timers.length === 0 && (
          <div className="text-center py-[72px] px-5">
            <div className="text-[52px] mb-4">⏳</div>
            <div className="text-lg font-bold text-[var(--color-mid)] mb-2">No timers yet</div>
            <div className="text-[13px] text-[var(--color-muted)] mb-6">
              Create a countdown for your next sale, launch, or event.
            </div>
            <button
              onClick={() => navigate("/timer/new")}
              className="bg-[var(--color-accent)] text-white border-none rounded-[10px] px-7 py-3 text-sm font-bold cursor-pointer font-[inherit]">
              + Create First Timer
            </button>
          </div>
        )}

        {/* Timer grid */}
        {!loading && timers.length > 0 && (
          <div
            className="grid gap-[18px]"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>

            {/* New timer card */}
            <div
              onClick={() => navigate("/timer/new")}
              className="border-2 border-dashed border-[var(--color-accentBdr)] rounded-2xl p-7 flex flex-col items-center justify-center gap-2.5 cursor-pointer bg-[var(--color-accentBg)] transition-all duration-150 min-h-[160px] hover:border-[var(--color-accent)]">
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-2xl font-light">
                +
              </div>
              <div className="text-[var(--color-accent)] font-bold text-[13px]">New Timer</div>
            </div>

            {/* Existing timers */}
            {timers.map((timer) => (
              <TimerGridCard
                key={timer.id}
                timer={timer}
                onEdit={() => navigate(`/timer/${timer.id}`)}
                onDelete={() => setDeleteModal(timer)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <DeleteModal
          timerName={deleteModal.name}
          onConfirm={() => { handleDelete(deleteModal); setDeleteModal(null); }}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}